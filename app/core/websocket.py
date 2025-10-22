# app/core/websocket.py
from fastapi import WebSocket
from typing import Dict, List
import json


class ConnectionManager:
    def __init__(self):
        # 按客户端类型区分连接
        self.active_connections: Dict[str, List[WebSocket]] = {
            "canvas": [],
            "display": [],
            "admin": [],
            "unknown": [],
        }

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections["unknown"].append(websocket)

    def disconnect(self, websocket: WebSocket):
        for client_type in self.active_connections:
            if websocket in self.active_connections[client_type]:
                self.active_connections[client_type].remove(websocket)
                break

    def set_client_type(self, websocket: WebSocket, client_type: str):
        if websocket in self.active_connections["unknown"]:
            self.active_connections["unknown"].remove(websocket)
            if client_type not in self.active_connections:
                client_type = "unknown"
            self.active_connections[client_type].append(websocket)

    # 向指定类型的客户端广播
    async def broadcast(self, message: dict, clients: List[str] = ["display", "admin"]):
        message_json = json.dumps(message)
        for client_type in clients:
            for connection in self.active_connections[client_type]:
                await connection.send_text(message_json)
        print("broadcast to", clients)

    # 向所有客户端广播
    async def broadcast_all(self, message: dict):
        message_json = json.dumps(message)
        all_connections = [
            conn for conns in self.active_connections.values() for conn in conns
        ]
        for connection in all_connections:
            await connection.send_text(message_json)


manager = ConnectionManager()
