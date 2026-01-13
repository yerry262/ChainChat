import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { FaWallet, FaSync, FaPaperPlane, FaUser, FaComments, FaSpinner, FaTrash, FaSignOutAlt } from 'react-icons/fa';

// XMTP Network options - 'production' for mainnet, 'dev' for testing
const XMTP_ENV = 'production';

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
  const [xmtpError, setXmtpError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef(null);
  const streamRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize ENS provider for mainnet
  useEffect(() => {
    const initEnsProvider = async () => {
      try {
        const mainnetProvider = new ethers.providers.JsonRpcProvider(
          'https://eth-mainnet.g.alchemy.com/v2/demo'
        );
        setEnsProvider(mainnetProvider);
      } catch (error) {
        console.error('Failed to initialize ENS provider:', error);
      }
    };
    initEnsProvider();
  }, []);

  // Load contacts from localStorage when wallet connects
  useEffect(() => {
    if (walletAddress) {
      loadContactsFromStorage(walletAddress);
    }
  }, [walletAddress]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.return?.();
      }
    };
  }, []);

  // Check if input is an ENS name
  const isEnsName = (input) => {
    return input?.includes('.') && (input.endsWith('.eth') || input.endsWith('.xyz') || input.endsWith('.com') || input.endsWith('.org'));
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

  // Reverse ENS lookup
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
    } catch (error) {
      console.error('Failed to load user ENS name:', error);
    } finally {
      setIsLoadingUserEns(false);
    }
  };

  // LocalStorage helpers for contacts
  const getStorageKey = (address) => `chainchat_contacts_${address.toLowerCase()}`;

  const loadContactsFromStorage = (address) => {
    try {
      const stored = localStorage.getItem(getStorageKey(address));
      if (stored) {
        setContacts(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const saveContactsToStorage = (address, contactsList) => {
    try {
      localStorage.setItem(getStorageKey(address), JSON.stringify(contactsList));
    } catch (error) {
      console.error('Failed to save contacts:', error);
    }
  };

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window.ethereum !== 'undefined';
  };

  // Get current network
  const getCurrentNetwork = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      
      const networkNames = {
        1: 'Ethereum Mainnet',
        5: 'Goerli Testnet',
        11155111: 'Sepolia Testnet',
        137: 'Polygon',
        80001: 'Mumbai Testnet',
        8453: 'Base',
        84532: 'Base Sepolia',
        42161: 'Arbitrum One',
        10: 'Optimism',
      };
      
      return {
        chainId: network.chainId,
        name: networkNames[network.chainId] || `Chain ${network.chainId}`,
        connected: true
      };
    } catch (error) {
      return null;
    }
  };

  // Connect wallet and initialize XMTP
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      alert('Please install MetaMask to use this app!');
      return;
    }

    setIsConnecting(true);
    setXmtpError(null);
    
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      setWallet(signer);
      setWalletAddress(address);

      // Get network info
      const netInfo = await getCurrentNetwork();
      setNetworkInfo(netInfo);

      // Initialize XMTP client
      await initializeXMTP(signer);
      
      // Load user's ENS name
      await loadUserEnsName(address);

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
      setXmtpError(null);
      
      // Dynamic import of XMTP
      const { Client } = await import('@xmtp/xmtp-js');
      
      // Create XMTP client - user needs to sign to authenticate
      const client = await Client.create(signer, { env: XMTP_ENV });
      setXmtpClient(client);
      
      // Load existing conversations
      await loadConversations(client);
      
      console.log('XMTP client initialized successfully');
      console.log('XMTP address:', client.address);
      
    } catch (error) {
      console.error('Failed to initialize XMTP:', error);
      setXmtpError(error.message);
      
      // If XMTP fails, still allow using the app for contact management
      if (error.message.includes('not registered')) {
        setXmtpError('Your wallet is not yet registered with XMTP. You will be prompted to sign a message to register.');
      }
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

  // Start conversation with contact
  const startConversation = async (contactAddress) => {
    if (!xmtpClient) {
      alert('XMTP client not initialized. Please reconnect your wallet.');
      return;
    }

    try {
      setIsLoading(true);
      
      // Check if the recipient can receive XMTP messages
      const canMessage = await xmtpClient.canMessage(contactAddress);
      if (!canMessage) {
        alert(`${contactAddress.slice(0, 8)}... is not on the XMTP network yet. They need to connect to an XMTP-enabled app first.`);
        return;
      }
      
      const conversation = await xmtpClient.conversations.newConversation(contactAddress);
      setSelectedConversation(conversation);
      await loadMessages(conversation);
      setShowAddContact(false);
      
      // Start streaming messages for this conversation
      startMessageStream(conversation);
      
    } catch (error) {
      console.error('Failed to start conversation:', error);
      alert('Failed to start conversation: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Start message stream for real-time updates
  const startMessageStream = async (conversation) => {
    // Cancel any existing stream
    if (streamRef.current) {
      streamRef.current.return?.();
    }
    
    try {
      const stream = await conversation.streamMessages();
      streamRef.current = stream;
      
      for await (const message of stream) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        scrollToBottom();
      }
    } catch (error) {
      console.error('Message stream error:', error);
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
    if (!selectedConversation || !newMessage.trim()) {
      return;
    }

    setIsSending(true);
    try {
      // Send message via XMTP
      await selectedConversation.send(newMessage);
      
      // Clear input and reload messages
      setNewMessage('');
      await loadMessages(selectedConversation);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message: ' + error.message);
    } finally {
      setIsSending(false);
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
          const resolvedAddress = await resolveEnsName(contactAddress);
          ensName = contactAddress;
          contactAddress = resolvedAddress;
          contactName = ensName;
        } catch (error) {
          alert(`Failed to resolve ENS name: ${error.message}`);
          return;
        }
      } else if (ethers.utils.isAddress(contactAddress)) {
        // Try reverse ENS lookup
        try {
          const reversedEns = await reverseEnsLookup(contactAddress);
          if (reversedEns) {
            ensName = reversedEns;
            contactName = ensName;
          } else {
            contactName = formatAddress(contactAddress);
          }
        } catch (error) {
          contactName = formatAddress(contactAddress);
        }
      } else {
        alert('Please enter a valid Ethereum address or ENS name');
        return;
      }

      // Check for duplicate
      if (contacts.some(c => c.contact_address.toLowerCase() === contactAddress.toLowerCase())) {
        alert('Contact already exists');
        return;
      }

      // Create new contact
      const newContact = {
        id: Date.now().toString(),
        contact_address: contactAddress,
        contact_name: contactName,
        ens_name: ensName,
        added_at: new Date().toISOString()
      };

      const updatedContacts = [...contacts, newContact];
      setContacts(updatedContacts);
      saveContactsToStorage(walletAddress, updatedContacts);
      
      setNewContactAddress('');
      alert(`Contact added successfully! ${ensName ? `(${ensName} → ${formatAddress(contactAddress)})` : ''}`);
    } catch (error) {
      console.error('Failed to add contact:', error);
      alert('Failed to add contact: ' + error.message);
    } finally {
      setIsResolvingEns(false);
    }
  };

  // Delete contact
  const deleteContact = (contactId) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      const updatedContacts = contacts.filter(c => c.id !== contactId);
      setContacts(updatedContacts);
      saveContactsToStorage(walletAddress, updatedContacts);
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

  // Disconnect wallet
  const disconnectWallet = () => {
    if (streamRef.current) {
      streamRef.current.return?.();
    }
    setWallet(null);
    setWalletAddress('');
    setXmtpClient(null);
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
    setContacts([]);
    setNetworkInfo(null);
    setUserEnsName(null);
    setXmtpError(null);
  };

  // Format address for display
  const formatAddress = (address, ensName = null) => {
    if (!address) return '';
    if (ensName) return ensName;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date for message grouping
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Login screen
  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mb-6">
              <FaComments className="text-6xl text-blue-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">ChainChat</h1>
              <p className="text-gray-600">Decentralized messaging on Ethereum</p>
            </div>
            
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Features:</h3>
              <ul className="text-sm text-blue-700 space-y-1 text-left">
                <li>• End-to-end encrypted messages via XMTP</li>
                <li>• Wallet-based authentication</li>
                <li>• ENS name support (alice.eth)</li>
                <li>• Works on any Ethereum network</li>
                <li>• No central server - fully decentralized</li>
              </ul>
            </div>

            {!isMetaMaskInstalled() ? (
              <div className="text-center">
                <p className="text-red-600 mb-4">MetaMask is required to use this app</p>
                <a 
                  href="https://metamask.io/download/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors inline-block"
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
            
            <p className="text-xs text-gray-500 mt-4">
              Powered by <a href="https://xmtp.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">XMTP Protocol</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-300 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FaComments className="text-2xl text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">ChainChat</h1>
        </div>
        
        {/* User Profile Display */}
        <div className="flex items-center space-x-2 md:space-x-3">
          {networkInfo && (
            <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-green-100 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-700">{networkInfo.name}</span>
            </div>
          )}
          
          {xmtpError && (
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1 bg-yellow-100 rounded-full">
              <span className="text-xs text-yellow-700">XMTP Error</span>
            </div>
          )}
          
          <div className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 transition-colors px-3 md:px-4 py-2 rounded-full border">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <FaUser className="text-white text-sm" />
            </div>
            <div className="hidden sm:flex flex-col">
              {isLoadingUserEns ? (
                <div className="flex items-center space-x-1">
                  <FaSpinner className="animate-spin text-xs" />
                  <span className="text-sm text-gray-600">Loading...</span>
                </div>
              ) : (
                <>
                  <span className="text-sm font-semibold text-gray-800">
                    {userEnsName || formatAddress(walletAddress)}
                  </span>
                  {userEnsName && (
                    <span className="text-xs text-gray-500">{formatAddress(walletAddress)}</span>
                  )}
                </>
              )}
            </div>
          </div>
          
          <button
            onClick={refreshMessages}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 text-gray-600"
            title="Refresh messages"
          >
            <FaSync className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={disconnectWallet}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
            title="Disconnect wallet"
          >
            <FaSignOutAlt />
          </button>
        </div>
      </div>

      {/* XMTP Error Banner */}
      {xmtpError && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-sm text-yellow-800">
          ⚠️ {xmtpError}
          <button 
            onClick={() => initializeXMTP(wallet)} 
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-white border-r border-gray-300 flex flex-col" 
             style={{ display: selectedConversation && window.innerWidth < 768 ? 'none' : 'flex' }}>
          {/* Sidebar Header */}
          <div className="p-4 bg-blue-50 border-b border-gray-200">
            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
            >
              <FaUser />
              <span>{showAddContact ? 'Cancel' : 'Add Contact'}</span>
            </button>
          </div>

          {/* Add Contact Form */}
          {showAddContact && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <input
                type="text"
                value={newContactAddress}
                onChange={(e) => setNewContactAddress(e.target.value)}
                placeholder="0x... or alice.eth"
                className="w-full p-2 border border-gray-300 rounded-lg mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isResolvingEns}
                onKeyPress={(e) => e.key === 'Enter' && addContact()}
              />
              <button
                onClick={addContact}
                disabled={isResolvingEns || !newContactAddress.trim()}
                className="w-full bg-blue-500 text-white py-2 px-3 rounded-lg text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isResolvingEns ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Resolving...</span>
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
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                <span>Contacts ({contacts.length})</span>
              </h3>
              {contacts.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No contacts yet. Add one above!</p>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="group p-3 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-200 transition-colors relative"
                    >
                      <div 
                        onClick={() => startConversation(contact.contact_address)}
                        className="flex-1"
                      >
                        <div className="font-semibold text-sm text-gray-800">
                          {contact.ens_name || contact.contact_name || formatAddress(contact.contact_address)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatAddress(contact.contact_address)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteContact(contact.id);
                        }}
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500 transition-opacity"
                        title="Delete contact"
                      >
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Conversations ({conversations.length})
              </h3>
              {conversations.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No conversations yet</p>
              ) : (
                <div className="space-y-2">
                  {conversations.map((convo) => (
                    <div
                      key={convo.topic}
                      onClick={() => {
                        setSelectedConversation(convo);
                        loadMessages(convo);
                        startMessageStream(convo);
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
        <div className="flex-1 flex flex-col" 
             style={{ display: !selectedConversation && window.innerWidth < 768 ? 'none' : 'flex' }}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-gray-300 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800">
                    Chat with {formatAddress(selectedConversation.peerAddress)}
                  </h2>
                  <p className="text-sm text-gray-500">End-to-end encrypted via XMTP</p>
                </div>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                >
                  ← Back
                </button>
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
                      const isOwn = message.senderAddress?.toLowerCase() === walletAddress.toLowerCase();
                      const showDate = index === 0 || 
                        formatDate(messages[index - 1]?.sent) !== formatDate(message.sent);
                      
                      return (
                        <React.Fragment key={message.id || index}>
                          {showDate && (
                            <div className="text-center text-xs text-gray-500 my-4">
                              {formatDate(message.sent)}
                            </div>
                          )}
                          <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl message-bubble ${
                              isOwn 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-white text-gray-800 border border-gray-200'
                            }`}>
                              <p className="text-sm break-words">{message.content}</p>
                              <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
                                {formatTime(message.sent)}
                              </p>
                            </div>
                          </div>
                        </React.Fragment>
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
                    onKeyPress={(e) => e.key === 'Enter' && !isSending && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="bg-blue-500 text-white px-4 md:px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isSending ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaPaperPlane />
                    )}
                    <span className="hidden md:inline">Send</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Messages are encrypted and stored on the XMTP network
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500 max-w-md px-4">
                <FaComments className="text-6xl mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-semibold mb-2">Welcome to ChainChat</h3>
                <p className="mb-4">Select a contact or start a new conversation to begin messaging.</p>
                <div className="text-sm space-y-2">
                  <p>✅ End-to-end encrypted</p>
                  <p>✅ Decentralized storage</p>
                  <p>✅ No central server</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
