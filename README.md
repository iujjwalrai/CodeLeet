<div align="center">
  <br />
  <h1>Nexcode</h1>
  <p><strong>A Highly Scalable, Open-Source Online Coding Platform & Judge System</strong></p>
</div>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#system-architecture">Architecture</a> •
  <a href="#prerequisites">Prerequisites</a> •
  <a href="#local-development">Local Setup</a> •
  <a href="#docker-setup">Docker Setup</a>
</p>

---

Nexcode is a **LeetCode-style online coding platform** that executes user-submitted code securely on the backend using **Docker**, **BullMQ**, and **Redis**, with **real-time execution updates** via WebSockets. 

It is designed to mimic how real-world online judges work—scalable, secure, and language-agnostic.

## ✨ Features

- 🧠 **Multi-Language Code Execution**: Full support for `C++`, `Java`, and `Python`.
- 🐳 **Secure Sandboxing**: User code is executed inside strictly isolated Docker containers with `--user nobody` and Read-Only mounts to prevent malicious actions.
- ⚙️ **Asynchronous Job Processing**: Utilizing `BullMQ` for highly reliable, distributed job queues.
- 🔄 **Redis-Backed State**: Lightning fast execution queue and caching mechanisms.
- 📡 **Real-Time WebSockets**: Execution results, test cases, and compilation logs are streamed live back to the user without heavy HTTP polling.
- ⏱️ **Resource Constrained**: Hard limits on memory, CPU, and execution timeout to prevent fork bombs and infinite loops.

## 🏗️ System Architecture

```mermaid
graph TD
    Client[React Frontend] -->|Submit Code (HTTP)| API[Express Backend API]
    API -->|Push Job| Queue[Redis BullMQ]
    Queue -->|Consume Job| Worker[Node.js Worker Service]
    Worker -->|Spawn Container| Docker[Docker Sandbox Environment]
    Docker -->|Return Result| Worker
    Worker -->|Publish Status| WS[WebSocket Server]
    WS -.->|Live Updates| Client
    API -->|Store Data| Mongo[(MongoDB)]
```

## 🧰 Tech Stack

- **Frontend**: React.js, Tailwind CSS, Vite, Socket.io-client
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), Socket.io
- **Queue System**: BullMQ, Redis
- **Execution Engine**: Docker Containerization

---

## 🚀 Getting Started

Follow these instructions to set up the Nexcode platform locally for development and testing.

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18.0.0 or higher)
- **Docker** (Must be running in the background)
- **Redis** (Local instance or Cloud URL)
- **MongoDB** (Local instance or Atlas URI)

---

### Local Development

#### 1. Clone the repository
```bash
git clone https://github.com/your-username/nexcode.git
cd nexcode
```

#### 2. Build the Docker Execution Images
The backend relies on isolated Docker images to execute code. You must build these locally:
```bash
cd backend/docker

# Build the C++ environment
docker build -t nexcode-cpp -f Dockerfile.cpp .

# Build the Java environment
docker build -t nexcode-java -f Dockerfile.java .

# Build the Python environment (if available)
docker build -t nexcode-python -f Dockerfile.python .
```

#### 3. Setup the Backend
```bash
cd ../ # Back to the backend folder
npm install

# Setup your environment variables
cp .env.example .env
```
Ensure your `.env` contains the correct values:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/nexcode
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=your_super_secret_key
COOKIE_NAME=nexcode_token
```

#### 4. Setup the Frontend
```bash
cd ../client
npm install

# Setup your environment variables
cp .env.example .env
```
Ensure your `.env` contains the correct URLs (default localhost):
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_API_BASE_URL_WS=ws://localhost:5000
```

#### 5. Run the Platform

You need to run four separate processes during development to ensure the queue and WebSocket servers run properly. Open 4 terminal tabs:

**Terminal 1 (Backend API):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Code Execution Worker):**
```bash
cd backend
npm run runWorker
```

**Terminal 3 (Submission Saving Worker):**
```bash
cd backend
npm run subWorker
```

**Terminal 4 (Frontend Client):**
```bash
cd client
npm run dev
```

Your platform should now be accessible at `http://localhost:5173`.

---

## 🔐 Security Details

Nexcode takes code execution security seriously. When a user submits code, the worker spawns a container with the following flags:
- `--network none`: Disables internet access to prevent external API calls or data exfiltration.
- `--user nobody`: Runs the execution as a non-root, unprivileged user.
- `--read-only`: The container's root filesystem is mounted as read-only.
- `--tmpfs /tmp`: Only a tiny temporary memory store is allowed for compiling intermediate binaries.
- `--pids-limit 64`: Prevents fork bombs.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the issues page if you want to contribute.

## 📜 License

This project is licensed under the MIT License.
