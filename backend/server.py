from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime
from web3 import Web3
from eth_account.messages import encode_defunct
import json
from bson import ObjectId
from fastapi.encoders import jsonable_encoder

# Custom JSON encoder for MongoDB ObjectId
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)

# Helper function to convert MongoDB documents to JSON-serializable format
def serialize_mongo_doc(doc):
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Web3 setup for Base Sepolia
infura_url = os.environ.get('INFURA_BASE_SEPOLIA_URL')
w3 = Web3(Web3.HTTPProvider(infura_url))

# Create the main app without a prefix
app = FastAPI(title="Web3 Messenger API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    wallet_address: str
    ens_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    wallet_address: str
    ens_name: Optional[str] = None

class WalletSignature(BaseModel):
    address: str
    signature: str
    message: str

class MessageMetadata(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_address: str
    recipient_address: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message_hash: Optional[str] = None
    xmtp_conversation_id: Optional[str] = None

class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_address: str
    contact_address: str
    contact_name: Optional[str] = None
    added_at: datetime = Field(default_factory=datetime.utcnow)

# Authentication endpoints
@api_router.post("/auth/verify-signature")
async def verify_wallet_signature(signature_data: WalletSignature):
    """Verify wallet signature for authentication"""
    try:
        # Create the message that was signed
        message = encode_defunct(text=signature_data.message)
        
        # Recover the address from signature
        recovered_address = w3.eth.account.recover_message(message, signature=signature_data.signature)
        
        # Check if recovered address matches claimed address
        if recovered_address.lower() != signature_data.address.lower():
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Check if user exists, create if not
        user = await db.users.find_one({"wallet_address": signature_data.address.lower()})
        if not user:
            new_user = User(wallet_address=signature_data.address.lower())
            await db.users.insert_one(new_user.dict())
            user = new_user.dict()
        else:
            # Update last seen
            await db.users.update_one(
                {"wallet_address": signature_data.address.lower()},
                {"$set": {"last_seen": datetime.utcnow()}}
            )
        
        return {
            "success": True,
            "wallet_address": signature_data.address.lower(),
            "user_id": user.get("id", str(uuid.uuid4()))
        }
    
    except Exception as e:
        logger.error(f"Signature verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Signature verification failed")

# User management endpoints
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    """Create a new user"""
    user = User(**user_data.dict())
    await db.users.insert_one(user.dict())
    return user

@api_router.get("/users/{wallet_address}")
async def get_user(wallet_address: str):
    """Get user by wallet address"""
    user = await db.users.find_one({"wallet_address": wallet_address.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_mongo_doc(user)

@api_router.get("/users")
async def get_all_users():
    """Get all users (for development purposes)"""
    users = await db.users.find().to_list(100)
    return [serialize_mongo_doc(user) for user in users]

# Message metadata endpoints
@api_router.post("/messages/metadata")
async def save_message_metadata(metadata: MessageMetadata):
    """Save message metadata (not the actual message content - that's on XMTP)"""
    await db.message_metadata.insert_one(metadata.dict())
    return {"success": True, "message_id": metadata.id}

@api_router.get("/messages/metadata/{wallet_address}")
async def get_message_metadata(wallet_address: str):
    """Get message metadata for a wallet address"""
    messages = await db.message_metadata.find({
        "$or": [
            {"sender_address": wallet_address.lower()},
            {"recipient_address": wallet_address.lower()}
        ]
    }).sort("timestamp", -1).to_list(100)
    return messages

# Contact management endpoints
@api_router.post("/contacts")
async def add_contact(contact: Contact):
    """Add a contact"""
    # Check if contact already exists
    existing = await db.contacts.find_one({
        "owner_address": contact.owner_address.lower(),
        "contact_address": contact.contact_address.lower()
    })
    
    if existing:
        raise HTTPException(status_code=409, detail="Contact already exists")
    
    contact.owner_address = contact.owner_address.lower()
    contact.contact_address = contact.contact_address.lower()
    await db.contacts.insert_one(contact.dict())
    return contact

@api_router.get("/contacts/{wallet_address}")
async def get_contacts(wallet_address: str):
    """Get contacts for a wallet address"""
    contacts = await db.contacts.find({"owner_address": wallet_address.lower()}).to_list(100)
    return contacts

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete a contact"""
    result = await db.contacts.delete_one({"id": contact_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"success": True}

# Network info endpoint
@api_router.get("/network-info")
async def get_network_info():
    """Get network information"""
    try:
        chain_id = w3.eth.chain_id
        latest_block = w3.eth.block_number
        return {
            "chain_id": chain_id,
            "latest_block": latest_block,
            "network": "Base Sepolia Testnet",
            "connected": True
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }

# Health check
@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "database": "connected" if client else "disconnected",
        "web3": "connected" if w3.is_connected() else "disconnected"
    }

@api_router.get("/")
async def root():
    return {"message": "Web3 Messenger API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()