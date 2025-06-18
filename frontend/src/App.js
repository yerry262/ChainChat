import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { Client } from '@xmtp/browser-sdk';
import { FaWallet, FaSync, FaPaperPlane, FaUser, FaComments, FaSpinner } from 'react-icons/fa';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BASE_SEPOLIA_CONFIG = {
  chainId: 84532,
  chainName: 'Base Sepolia',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia-explorer.base.org'],
};

function App() {
  // State management
  const [wallet, setWallet] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [xmtpClient, setXmtpClient] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newContactAddress, setNewContactAddress] = useState('');
  const [contacts, setContacts] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [isResolvingEns, setIsResolvingEns] = useState(false);
  const [ensProvider, setEnsProvider] = useState(null);
  const [userEnsName, setUserEnsName] = useState(null);
  const [isLoadingUserEns, setIsLoadingUserEns] = useState(false);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize ENS provider for mainnet (ENS resolution)
    const initEnsProvider = async () => {
      try {
        // Use Infura mainnet for ENS resolution
        const mainnetProvider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/4bf26402ae474ff98fb4e4f76ccfc4ba');
        setEnsProvider(mainnetProvider);
      } catch (error) {
        console.error('Failed to initialize ENS provider:', error);
      }
    };
    
    initEnsProvider();
  }, []);

  // Check if input is an ENS name
  const isEnsName = (input) => {
    return input.includes('.') && (input.endsWith('.eth') || input.endsWith('.xyz') || input.endsWith('.com') || input.endsWith('.org'));
  };

  // Resolve ENS name to address
  const resolveEnsName = async (ensName) => {
    if (!ensProvider) {
      throw new Error('ENS provider not initialized');
    }
    
    try {
      setIsResolvingEns(true);
      const address = await ensProvider.resolveName(ensName);
      if (!address) {
        throw new Error('ENS name not found');
      }
      return address;
    } catch (error) {
      console.error('ENS resolution failed:', error);
      throw new Error(`Failed to resolve ENS name: ${error.message}`);
    } finally {
      setIsResolvingEns(false);
    }
  };

  // Reverse ENS lookup (address to name)
  const reverseEnsLookup = async (address) => {
    if (!ensProvider) return null;
    
    try {
      const ensName = await ensProvider.lookupAddress(address);
      return ensName;
    } catch (error) {
      console.error('Reverse ENS lookup failed:', error);
      return null;
    }
  };

  // Load user's ENS name
  const loadUserEnsName = async (address) => {
    if (!ensProvider) return;
    
    try {
      setIsLoadingUserEns(true);
      const ensName = await reverseEnsLookup(address);
      setUserEnsName(ensName);
      if (ensName) {
        console.log(`Found ENS name for user: ${ensName}`);
      }
    } catch (error) {
      console.error('Failed to load user ENS name:', error);
    } finally {
      setIsLoadingUserEns(false);
    }
  };
  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window.ethereum !== 'undefined';
  };

  // Switch to Base Sepolia network
  const switchToBaseSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }], // 84532 in hex
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [BASE_SEPOLIA_CONFIG],
          });
        } catch (addError) {
          console.error('Failed to add Base Sepolia network:', addError);
        }
      }
    }
  };

  // Connect wallet and initialize XMTP
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      alert('Please install MetaMask to use this app!');
      return;
    }

    setIsConnecting(true);
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Switch to Base Sepolia
      await switchToBaseSepolia();
      
      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      setWallet(signer);
      setWalletAddress(address);

      // Verify signature with backend
      const message = `Sign this message to authenticate with Web3 Messenger at ${new Date().toISOString()}`;
      const signature = await signer.signMessage(message);
      
      const authResponse = await axios.post(`${API}/auth/verify-signature`, {
        address: address,
        signature: signature,
        message: message
      });

      if (authResponse.data.success) {
        // Initialize XMTP client
        await initializeXMTP(signer);
        
        // Load user's ENS name
        await loadUserEnsName(address);
        
        // Load contacts
        await loadContacts(address);
        
        // Get network info
        await getNetworkInfo();
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Initialize XMTP client
  const initializeXMTP = async (signer) => {
    try {
      console.log('Initializing XMTP client...');
      const client = await Client.create(signer, { env: 'dev' });
      setXmtpClient(client);
      
      // Load existing conversations
      await loadConversations(client);
      
      console.log('XMTP client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize XMTP:', error);
      alert('Failed to initialize XMTP: ' + error.message);
    }
  };

  // Load conversations
  const loadConversations = async (client) => {
    try {
      const convos = await client.conversations.list();
      setConversations(convos);
      console.log(`Loaded ${convos.length} conversations`);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  // Load contacts from backend
  const loadContacts = async (address) => {
    try {
      const response = await axios.get(`${API}/contacts/${address}`);
      setContacts(response.data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  // Get network info
  const getNetworkInfo = async () => {
    try {
      const response = await axios.get(`${API}/network-info`);
      setNetworkInfo(response.data);
    } catch (error) {
      console.error('Failed to get network info:', error);
    }
  };

  // Start conversation with contact
  const startConversation = async (contactAddress) => {
    if (!xmtpClient) {
      alert('XMTP client not initialized');
      return;
    }

    try {
      setIsLoading(true);
      const conversation = await xmtpClient.conversations.newConversation(contactAddress);
      setSelectedConversation(conversation);
      await loadMessages(conversation);
      setShowAddContact(false);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      alert('Failed to start conversation: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages for selected conversation
  const loadMessages = async (conversation) => {
    try {
      const msgs = await conversation.messages();
      setMessages(msgs);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim() || !wallet) {
      return;
    }

    try {
      // Sign the message with wallet
      const messageToSign = `Message: ${newMessage} | Timestamp: ${new Date().toISOString()}`;
      const signature = await wallet.signMessage(messageToSign);
      
      // Send message via XMTP
      await selectedConversation.send(newMessage);
      
      // Save metadata to backend
      await axios.post(`${API}/messages/metadata`, {
        sender_address: walletAddress,
        recipient_address: selectedConversation.peerAddress,
        message_hash: signature,
        xmtp_conversation_id: selectedConversation.topic
      });

      // Clear input and reload messages
      setNewMessage('');
      await loadMessages(selectedConversation);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message: ' + error.message);
    }
  };

  // Add contact
  const addContact = async () => {
    if (!newContactAddress.trim()) {
      alert('Please enter a wallet address or ENS name');
      return;
    }

    try {
      setIsResolvingEns(true);
      let contactAddress = newContactAddress.trim();
      let contactName = newContactAddress.trim();
      let ensName = null;

      // Check if it's an ENS name
      if (isEnsName(contactAddress)) {
        try {
          // Resolve ENS name to address
          const resolvedAddress = await resolveEnsName(contactAddress);
          ensName = contactAddress;
          contactAddress = resolvedAddress;
          contactName = ensName; // Use ENS name as display name
          console.log(`Resolved ${ensName} to ${contactAddress}`);
        } catch (error) {
          alert(`Failed to resolve ENS name: ${error.message}`);
          return;
        }
      } else if (ethers.utils.isAddress(contactAddress)) {
        // It's a regular address, try reverse ENS lookup
        try {
          const reversedEns = await reverseEnsLookup(contactAddress);
          if (reversedEns) {
            ensName = reversedEns;
            contactName = ensName;
            console.log(`Found ENS name ${ensName} for address ${contactAddress}`);
          } else {
            contactName = contactAddress.slice(0, 6) + '...' + contactAddress.slice(-4);
          }
        } catch (error) {
          console.log('No ENS name found for address');
          contactName = contactAddress.slice(0, 6) + '...' + contactAddress.slice(-4);
        }
      } else {
        alert('Please enter a valid Ethereum address or ENS name');
        return;
      }

      // Add contact to backend
      await axios.post(`${API}/contacts`, {
        owner_address: walletAddress,
        contact_address: contactAddress,
        contact_name: contactName,
        ens_name: ensName
      });

      setNewContactAddress('');
      await loadContacts(walletAddress);
      alert(`Contact added successfully! ${ensName ? `(${ensName} → ${formatAddress(contactAddress)})` : ''}`);
    } catch (error) {
      console.error('Failed to add contact:', error);
      alert('Failed to add contact: ' + error.message);
    } finally {
      setIsResolvingEns(false);
    }
  };

  // Refresh messages
  const refreshMessages = async () => {
    if (!xmtpClient) return;
    
    setIsLoading(true);
    try {
      await loadConversations(xmtpClient);
      if (selectedConversation) {
        await loadMessages(selectedConversation);
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format address for display (with ENS support)
  const formatAddress = (address, ensName = null) => {
    if (!address) return '';
    if (ensName) return ensName;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mb-6">
              <FaComments className="text-6xl text-blue-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Web3 Messenger</h1>
              <p className="text-gray-600">Secure, decentralized messaging powered by XMTP</p>
            </div>
            
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Features:</h3>
              <ul className="text-sm text-blue-700 space-y-1 text-left">
                <li>• End-to-end encrypted messages via XMTP</li>
                <li>• Wallet-based authentication</li>
                <li>• Messages signed with your wallet</li>
                <li>• ENS name support (alice.eth)</li>
                <li>• Built on Base Sepolia testnet</li>
              </ul>
            </div>

            {!isMetaMaskInstalled() ? (
              <div className="text-center">
                <p className="text-red-600 mb-4">MetaMask is required to use this app</p>
                <a 
                  href="https://metamask.io/download/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Install MetaMask
                </a>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaWallet />
                <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-300 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold">Web3 Messenger</h1>
            <button
              onClick={refreshMessages}
              disabled={isLoading}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <FaSync className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          <p className="text-sm opacity-90">{formatAddress(walletAddress)}</p>
          {networkInfo && (
            <p className="text-xs opacity-75">{networkInfo.network}</p>
          )}
        </div>

        {/* Add Contact Button */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
          >
            <FaUser />
            <span>Add Contact</span>
          </button>
        </div>

        {/* Add Contact Form */}
        {showAddContact && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <input
              type="text"
              value={newContactAddress}
              onChange={(e) => setNewContactAddress(e.target.value)}
              placeholder="Enter wallet address (0x...) or ENS name (alice.eth)"
              className="w-full p-2 border border-gray-300 rounded-lg mb-2 text-sm"
              disabled={isResolvingEns}
            />
            <button
              onClick={addContact}
              disabled={isResolvingEns || !newContactAddress.trim()}
              className="w-full bg-blue-500 text-white py-1 px-3 rounded text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isResolvingEns ? (
                <>
                  <FaSpinner className="animate-spin" />
                  <span>Resolving ENS...</span>
                </>
              ) : (
                <span>Add Contact</span>
              )}
            </button>
          </div>
        )}

        {/* Contacts/Conversations List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Contacts</h3>
            {contacts.length === 0 ? (
              <p className="text-gray-500 text-sm">No contacts yet. Add one above!</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => startConversation(contact.contact_address)}
                    className="p-3 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-200 transition-colors"
                  >
                    <div className="font-semibold text-sm">
                      {contact.ens_name || contact.contact_name || formatAddress(contact.contact_address)}
                    </div>
                    {contact.ens_name && (
                      <div className="text-xs text-gray-500">{formatAddress(contact.contact_address)}</div>
                    )}
                    {!contact.ens_name && (
                      <div className="text-xs text-gray-500">{formatAddress(contact.contact_address)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Conversations</h3>
            {conversations.length === 0 ? (
              <p className="text-gray-500 text-sm">No conversations yet</p>
            ) : (
              <div className="space-y-2">
                {conversations.map((convo) => (
                  <div
                    key={convo.topic}
                    onClick={() => {
                      setSelectedConversation(convo);
                      loadMessages(convo);
                    }}
                    className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                      selectedConversation?.topic === convo.topic 
                        ? 'bg-blue-100 border-blue-300' 
                        : 'hover:bg-gray-100 border-gray-200'
                    }`}
                  >
                    <div className="font-semibold text-sm">{formatAddress(convo.peerAddress)}</div>
                    <div className="text-xs text-gray-500">Click to load messages</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-300">
              <h2 className="font-semibold">Chat with {formatAddress(selectedConversation.peerAddress)}</h2>
              <p className="text-sm text-gray-500">End-to-end encrypted via XMTP</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                  <FaComments className="text-4xl mx-auto mb-2 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const isOwn = message.senderAddress.toLowerCase() === walletAddress.toLowerCase();
                    return (
                      <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          isOwn 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
                            {formatTime(message.sent)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-300">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' ? sendMessage() : null}
                  placeholder="Type your message... (will be signed with your wallet)"
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <FaPaperPlane />
                  <span>Send</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Messages are encrypted and stored on XMTP network</p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <FaComments className="text-6xl mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-semibold mb-2">Welcome to Web3 Messenger</h3>
              <p className="mb-4">Select a contact or conversation to start messaging</p>
              <p className="text-sm">All messages are end-to-end encrypted and signed with your wallet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;