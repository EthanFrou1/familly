import * as signalR from '@microsoft/signalr'
import { getToken } from './api'

const PROD_HUB_URL = 'https://familly-production.up.railway.app/hubs/game'
const HUB_URL = import.meta.env.DEV
  ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/hubs/game`
  : PROD_HUB_URL

let connection = null

function getConnection() {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      // Le hub tourne directement sur Railway (le proxy Vercel ne gère pas les
      // WebSockets), donc le cookie posé côté mybigfamily.fr n'est jamais
      // envoyé ici : on authentifie avec le JWT déjà stocké côté client.
      .withUrl(HUB_URL, { accessTokenFactory: () => getToken() })
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

let reconnectHandler = null
let reconnectListenerAttached = false

// SignalR (withAutomaticReconnect) rétablit la connexion transport toute seule après une coupure
// réseau, mais avec un nouveau ConnectionId — le serveur ne sait donc pas relier ça au joueur tant
// qu'on n'a pas rappelé JoinRoom. Un seul handler à la fois : la page de jeu montée l'enregistre à
// la connexion et le retire à son démontage (voir *GameRemote.jsx), sinon les handlers d'anciennes
// pages s'accumuleraient sur cette connexion singleton partagée entre les écrans.
export function setReconnectHandler(handler) {
  reconnectHandler = handler
  const conn = getConnection()
  if (!reconnectListenerAttached) {
    conn.onreconnected(() => { reconnectHandler?.() })
    reconnectListenerAttached = true
  }
}

export const gameHub = {
  getOpenRooms: () => getConnection().invoke('GetOpenRooms'),
  createRoom: (gameType) => getConnection().invoke('CreateRoom', gameType),
  joinRoom: (code) => getConnection().invoke('JoinRoom', code),
  leaveRoom: () => getConnection().invoke('LeaveRoom'),
  startGame: (pairsCount) => getConnection().invoke('StartGame', pairsCount),
  pauseGame: () => getConnection().invoke('PauseGame'),
  resumeGame: () => getConnection().invoke('ResumeGame'),
  kickDisconnectedPlayer: (memberId) => getConnection().invoke('KickDisconnectedPlayer', memberId),
  spinWheel: () => getConnection().invoke('SpinWheel'),
  flipCard: (cardId) => getConnection().invoke('FlipCard', cardId),
  skipTurn: () => getConnection().invoke('SkipTurn'),
  playAgain: () => getConnection().invoke('PlayAgain'),
  startQuiz: (questionCount) => getConnection().invoke('StartQuiz', questionCount),
  answerQuestion: (key) => getConnection().invoke('AnswerQuestion', key),
  startSimultaneousGame: (roundCount) => getConnection().invoke('StartSimultaneousGame', roundCount),
  startFamilyTriviaGame: (roundCount, categories) => getConnection().invoke('StartSimultaneousGame', roundCount, categories),
  submitAnswer: (key) => getConnection().invoke('SubmitAnswer', key),
  revealNextClue: () => getConnection().invoke('RevealNextClue'),
  forceResolveRound: () => getConnection().invoke('ForceResolveRound'),
  continueRound: () => getConnection().invoke('ContinueRound'),
  assignTeam: (memberId, teamIndex) => getConnection().invoke('AssignTeam', memberId, teamIndex),
  startFamilleEnOrGame: (roundCount) => getConnection().invoke('StartFamilleEnOrGame', roundCount),
  buzz: () => getConnection().invoke('Buzz'),
  submitTeamAnswer: (text) => getConnection().invoke('SubmitTeamAnswer', text),
  forceResolveFamilleEnOrRound: () => getConnection().invoke('ForceResolveFamilleEnOrRound'),
  continueFamilleEnOrRound: () => getConnection().invoke('ContinueFamilleEnOrRound'),
  startUndercoverGame: (undercoverCount, mrWhiteCount) => getConnection().invoke('StartUndercoverGame', undercoverCount, mrWhiteCount),
  advanceUndercoverTurn: () => getConnection().invoke('AdvanceUndercoverTurn'),
  submitUndercoverVote: (targetMemberId) => getConnection().invoke('SubmitUndercoverVote', targetMemberId),
  forceResolveUndercoverVote: () => getConnection().invoke('ForceResolveUndercoverVote'),
  submitMrWhiteGuess: (guess) => getConnection().invoke('SubmitMrWhiteGuess', guess),
  continueUndercoverRound: () => getConnection().invoke('ContinueUndercoverRound'),
}
