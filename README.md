# CodeLeet — Online Coding Platform & Judge System

CodeLeet is a **LeetCode-style online coding platform** that executes user-submitted code securely on the backend using **Docker**, **BullMQ**, and **Redis**, with **real-time execution updates** via WebSockets.

It is designed to mimic how real-world online judges work — scalable, secure, and language-agnostic.

---

## ✨ Features

- 🧠 Multi-language code execution  
  - Python  
  - Java  
  - C++
- 🐳 Secure execution using Docker containers
- ⚙️ Asynchronous job processing with BullMQ
- 🔄 Redis-backed queue system
- 📡 Real-time execution updates (no polling)
- 🧪 Hidden and public test cases
- ⏱️ Time & memory constrained execution
- 📊 Submission and verdict tracking

---

## 🏗️ System Architecture


Client (Frontend)
|
| HTTP (Submit Code)
v
Backend API (Express.js)
|
| Push Job
v
Redis Queue (BullMQ)
|
| Fetch Job
v
Worker Service
|
| Execute Code in Docker
v
Execution Result
|
| Publish Status
v
WebSocket Server ───▶ Client



---

## 🧰 Tech Stack

### Frontend
- React
- Tailwind CSS
- Axios
- Native WebSocket API

### Backend
- Node.js
- Express.js
- MongoDB (Mongoose)
- BullMQ
- Redis

### Infrastructure
- Docker
- Isolated language containers
- Cloud / Local Redis

---


## ⚙️ How Code Execution Works

1. User submits code from frontend
2. Backend validates and stores submission
3. Job is pushed to BullMQ queue
4. Worker picks the job
5. Code runs inside a Docker container
6. Output is matched against test cases
7. Live status updates are sent via WebSocket
8. Final verdict is stored and returned

---

## 🔐 Security

- No internet access inside containers
- CPU and memory limits per execution
- Automatic container cleanup (`--rm`)
- Language-isolated Docker images
- Execution timeout enforcement

---
