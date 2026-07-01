import * as signalR from '@microsoft/signalr'

const PROD_HUB_URL = 'https://familly-production.up.railway.app/hubs/game'
const HUB_URL = import.meta.env.DEV
  ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/hubs/game`
  : PROD_HUB_URL

let connection = null

function getConnection() {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { withCredentials: true })
      .withAutomaticReconnect()
      .build()
  }
  return connection
}

export async function connectHub() {
  const conn = getConnection()
  if (conn.state === signalR.HubConnectionState.Disconnected) {
    await conn.start()
  }
  return conn
}

export async function disconnectHub() {
  if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
    await connection.stop()
  }
}

// Abonne `handler` à un événement du hub, renvoie une fonction de désabonnement.
export function onHubEvent(event, handler) {
  getConnection().on(event, handler)
  return () => getConnection().off(event, handler)
}

export const gameHub = {
  createRoom: (gameType) => getConnection().invoke('CreateRoom', gameType),
  joinRoom: (code) => getConnection().invoke('JoinRoom', code),
  leaveRoom: () => getConnection().invoke('LeaveRoom'),
  startGame: (pairsCount) => getConnection().invoke('StartGame', pairsCount),
  spinWheel: () => getConnection().invoke('SpinWheel'),
  flipCard: (cardId) => getConnection().invoke('FlipCard', cardId),
  playAgain: () => getConnection().invoke('PlayAgain'),
}
