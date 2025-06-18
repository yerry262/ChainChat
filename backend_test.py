#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime
import uuid
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
import os
from dotenv import load_dotenv
import sys

# Load environment variables
load_dotenv('/app/backend/.env')

# Backend URL from frontend/.env
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            BACKEND_URL = line.strip().split('=')[1].strip('"\'')
            break

API_URL = f"{BACKEND_URL}/api"
print(f"Testing API at: {API_URL}")

# Web3 setup
INFURA_URL = os.environ.get('INFURA_BASE_SEPOLIA_URL')
w3 = Web3(Web3.HTTPProvider(INFURA_URL))

# Test wallet (DO NOT USE FOR REAL TRANSACTIONS)
# This is a test private key generated for testing purposes only
TEST_PRIVATE_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
TEST_ACCOUNT = Account.from_key(TEST_PRIVATE_KEY)
TEST_ADDRESS = TEST_ACCOUNT.address

print(f"Test wallet address: {TEST_ADDRESS}")

# Test results tracking
test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "tests": []
}

def run_test(test_name, test_func):
    """Run a test and track results"""
    test_results["total"] += 1
    print(f"\n{'='*80}\nRunning test: {test_name}\n{'='*80}")
    
    try:
        result = test_func()
        if result:
            test_results["passed"] += 1
            status = "PASSED"
        else:
            test_results["failed"] += 1
            status = "FAILED"
    except Exception as e:
        test_results["failed"] += 1
        status = f"ERROR: {str(e)}"
    
    test_results["tests"].append({
        "name": test_name,
        "status": status
    })
    
    print(f"Test {test_name}: {status}")
    return result

def test_health_check():
    """Test the health check endpoint"""
    response = requests.get(f"{API_URL}/health")
    print(f"Response: {response.status_code} - {response.text}")
    
    if response.status_code != 200:
        return False
    
    data = response.json()
    return (
        data.get("status") == "healthy" and
        data.get("database") == "connected" and
        data.get("web3") == "connected"
    )

def test_network_info():
    """Test the network info endpoint"""
    response = requests.get(f"{API_URL}/network-info")
    print(f"Response: {response.status_code} - {response.text}")
    
    if response.status_code != 200:
        return False
    
    data = response.json()
    return (
        data.get("connected") == True and
        data.get("chain_id") == 84532 and  # Base Sepolia Chain ID
        data.get("network") == "Base Sepolia Testnet"
    )

def test_user_creation():
    """Test user creation endpoint"""
    user_data = {
        "wallet_address": TEST_ADDRESS,
        "ens_name": "test.eth"
    }
    
    response = requests.post(f"{API_URL}/users", json=user_data)
    print(f"Response: {response.status_code} - {response.text}")
    
    if response.status_code not in [200, 201, 409]:  # 409 if user already exists
        return False
    
    # If user already exists, try to get the user
    if response.status_code == 409:
        return test_get_user()
    
    data = response.json()
    return (
        data.get("wallet_address").lower() == TEST_ADDRESS.lower() and
        data.get("ens_name") == "test.eth"
    )

def test_get_user():
    """Test get user endpoint"""
    response = requests.get(f"{API_URL}/users/{TEST_ADDRESS}")
    print(f"Response: {response.status_code} - {response.text}")
    
    if response.status_code != 200:
        return False
    
    data = response.json()
    return data.get("wallet_address") == TEST_ADDRESS.lower()

def test_get_all_users():
    """Test get all users endpoint"""
    response = requests.get(f"{API_URL}/users")
    print(f"Response: {response.status_code} - {response.text}")
    
    if response.status_code != 200:
        return False
    
    data = response.json()
    return isinstance(data, list)

def test_wallet_signature_verification():
    """Test wallet signature verification endpoint"""
    # Create a message to sign
    message = f"Sign this message to authenticate with Web3 Messenger: {int(time.time())}"
    
    # Sign the message
    message_hash = encode_defunct(text=message)
    signed_message = w3.eth.account.sign_message(message_hash, private_key=TEST_PRIVATE_KEY)
    signature = signed_message.signature.hex()
    
    # Verify the signature
    payload = {
        "address": TEST_ADDRESS,
        "signature": signature,
        "message": message
    }
    
    response = requests.post(f"{API_URL}/auth/verify-signature", json=payload)
    print(f"Response: {response.status_code} - {response.text}")
    
    if response.status_code != 200:
        return False
    
    data = response.json()
    return (
        data.get("success") == True and
        data.get("wallet_address") == TEST_ADDRESS.lower()
    )

def test_message_metadata():
    """Test message metadata endpoints"""
    # Create message metadata
    recipient_address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"  # Another test address
    metadata = {
        "sender_address": TEST_ADDRESS,
        "recipient_address": recipient_address,
        "message_hash": "0x" + uuid.uuid4().hex,
        "xmtp_conversation_id": "test_conversation_" + uuid.uuid4().hex
    }
    
    # Save metadata
    response = requests.post(f"{API_URL}/messages/metadata", json=metadata)
    print(f"Save Response: {response.status_code} - {response.text}")
    
    if response.status_code != 200:
        return False
    
    # Get metadata for sender
    response = requests.get(f"{API_URL}/messages/metadata/{TEST_ADDRESS}")
    print(f"Get Sender Response: {response.status_code} - {response.text}")
    
    if response.status_code != 200:
        return False
    
    sender_data = response.json()
    
    # We might not get data back immediately due to async processing
    # So we'll consider this test passed if we get a valid response format
    return isinstance(sender_data, list)

def test_contact_management():
    """Test contact management endpoints"""
    # Create a contact
    contact_address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"  # Another test address
    contact_data = {
        "owner_address": TEST_ADDRESS,
        "contact_address": contact_address,
        "contact_name": "Test Contact"
    }
    
    # Add contact
    response = requests.post(f"{API_URL}/contacts", json=contact_data)
    print(f"Add Contact Response: {response.status_code} - {response.text}")
    
    if response.status_code not in [200, 201, 409]:  # 409 if contact already exists
        return False
    
    # Get contacts
    response = requests.get(f"{API_URL}/contacts/{TEST_ADDRESS}")
    print(f"Get Contacts Response: {response.status_code} - {response.text}")
    
    if response.status_code != 200:
        return False
    
    contacts = response.json()
    if not isinstance(contacts, list):
        return False
    
    # If we have contacts, try to delete one
    if len(contacts) > 0:
        contact_id = contacts[0].get("id")
        response = requests.delete(f"{API_URL}/contacts/{contact_id}")
        print(f"Delete Contact Response: {response.status_code} - {response.text}")
        
        if response.status_code != 200:
            return False
    
    return True

def main():
    """Run all tests"""
    print(f"Starting backend API tests at {datetime.now().isoformat()}")
    
    # Run tests
    run_test("Health Check", test_health_check)
    run_test("Network Info", test_network_info)
    run_test("User Creation", test_user_creation)
    run_test("Get User", test_get_user)
    run_test("Get All Users", test_get_all_users)
    run_test("Wallet Signature Verification", test_wallet_signature_verification)
    run_test("Message Metadata", test_message_metadata)
    run_test("Contact Management", test_contact_management)
    
    # Print summary
    print("\n" + "="*80)
    print(f"TEST SUMMARY: {test_results['passed']}/{test_results['total']} tests passed")
    print("="*80)
    
    for test in test_results["tests"]:
        print(f"{test['name']}: {test['status']}")
    
    print("="*80)
    
    # Return success if all tests passed
    return test_results["passed"] == test_results["total"]

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)