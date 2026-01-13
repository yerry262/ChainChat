# ChainChat 💬

A decentralized messaging application built on Ethereum, powered by the [XMTP Protocol](https://xmtp.org).

**Live Demo:** [https://yerry262.github.io/ChainChat](https://yerry262.github.io/ChainChat)

## Features

- 🔐 **End-to-End Encryption** - All messages are encrypted using XMTP protocol
- 👛 **Wallet Authentication** - Connect with MetaMask or any Web3 wallet
- 🏷️ **ENS Support** - Send messages using ENS names (alice.eth)
- 🌐 **Network Agnostic** - Works on any Ethereum network
- 💾 **Decentralized Storage** - Messages stored on XMTP network, not a central server
- 📱 **Responsive Design** - Works on desktop and mobile devices

## How It Works

1. **Connect Wallet** - Connect your MetaMask or compatible wallet
2. **Sign Message** - Sign a message to authenticate with XMTP network
3. **Add Contacts** - Add contacts using wallet addresses or ENS names
4. **Start Chatting** - Send encrypted messages to anyone on XMTP

## Technology Stack

- **Frontend:** React 18, TailwindCSS
- **Messaging Protocol:** [XMTP](https://xmtp.org) - Decentralized messaging
- **Wallet Integration:** ethers.js
- **ENS Resolution:** Ethereum Name Service support
- **Storage:** Browser localStorage for contacts, XMTP for messages

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible Web3 wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/yerry262/ChainChat.git
cd ChainChat/frontend

# Install dependencies
npm install

# Start development server
npm start
```

The app will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

### Deploying to GitHub Pages

```bash
npm run deploy
```

## Project Structure

```
ChainChat/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   ├── src/
│   │   ├── App.js          # Main application component
│   │   ├── App.css         # Styles
│   │   ├── index.js        # Entry point
│   │   └── index.css       # Global styles
│   └── package.json
└── README.md
```

## How XMTP Works

XMTP (Extensible Message Transport Protocol) is a decentralized messaging protocol:

- Messages are encrypted client-side before transmission
- No central server stores your messages
- Your wallet keys control access to your messages
- Messages persist across any XMTP-enabled application

## Security

- **No Backend Required** - This app is fully client-side
- **Wallet Authentication** - Only you can access your messages
- **End-to-End Encryption** - Messages encrypted before leaving your device
- **Contacts Stored Locally** - Your contact list is stored in browser localStorage

## Requirements

- **MetaMask** or compatible Web3 wallet
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [XMTP Labs](https://xmtp.org) for the messaging protocol
- [Ethereum Foundation](https://ethereum.org) for ENS
- [MetaMask](https://metamask.io) for wallet integration

---

Built with ❤️ for the decentralized web
