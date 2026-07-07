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

- **Frontend:** React 18, Vite, TailwindCSS
- **Messaging Protocol:** [XMTP V3](https://xmtp.org) via `@xmtp/browser-sdk` (MLS-based; the legacy V2 network was sunset in June 2025)
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
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The production build is written to `frontend/dist/`. Preview it locally with `npm run preview`.

### Deploying to GitHub Pages

Every push to `main` is built and deployed automatically by the GitHub Actions workflow in `.github/workflows/deploy.yml`. To deploy manually instead:

```bash
npm run deploy
```

## Project Structure

```
ChainChat/
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages deployment
├── frontend/
│   ├── index.html          # Vite entry HTML
│   ├── public/
│   │   └── manifest.json
│   ├── src/
│   │   ├── App.jsx         # Main application component
│   │   ├── App.css         # Styles
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # Global styles (Tailwind)
│   ├── vite.config.js
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
