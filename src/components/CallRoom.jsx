import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export default function CallRoom({ roomId, profile, title, onLeave }) {
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [remoteStreams, setRemoteStreams] = useState({}) // peerId -> MediaStream
  const [participantNames, setParticipantNames] = useState({}) // peerId -> name
  const [status, setStatus] = useState('connecting') // connecting | live | error
  const [errorMsg, setErrorMsg] = useState('')

  const localVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const channelRef = useRef(null)
  const peersRef = useRef({}) // peerId -> RTCPeerConnection

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      } catch (err) {
        setStatus('error')
        setErrorMsg('Could not access camera/microphone. Check browser permissions and try again.')
        return
      }

      const channel = supabase.channel(`call-${roomId}`, {
        config: { presence: { key: profile.id }, broadcast: { self: false } },
      })
      channelRef.current = channel

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const otherIds = Object.keys(state).filter((id) => id !== profile.id)
        const names = {}
        otherIds.forEach((id) => { names[id] = state[id]?.[0]?.name || 'Participant' })
        setParticipantNames((prev) => ({ ...prev, ...names }))

        otherIds.forEach((otherId) => {
          if (!peersRef.current[otherId] && profile.id < otherId) {
            initiateOffer(otherId)
          }
        })
        setStatus('live')
      })

      channel.on('presence', { event: 'leave' }, ({ key }) => {
        removePeer(key)
      })

      channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (payload.target !== profile.id) return
        handleSignal(payload)
      })

      channel.subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          await channel.track({ id: profile.id, name: profile.name })
        }
      })
    }

    function createPeerConnection(peerId) {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current))
      }
      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast', event: 'signal',
            payload: { type: 'candidate', from: profile.id, target: peerId, candidate: e.candidate },
          })
        }
      }
      pc.ontrack = (e) => {
        setRemoteStreams((prev) => ({ ...prev, [peerId]: e.streams[0] }))
      }
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          removePeer(peerId)
        }
      }
      peersRef.current[peerId] = pc
      return pc
    }

    async function initiateOffer(peerId) {
      const pc = createPeerConnection(peerId)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      channelRef.current.send({
        type: 'broadcast', event: 'signal',
        payload: { type: 'offer', from: profile.id, target: peerId, sdp: offer },
      })
    }

    async function handleSignal(payload) {
      const { type, from, sdp, candidate } = payload
      if (type === 'offer') {
        const pc = peersRef.current[from] || createPeerConnection(from)
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        channelRef.current.send({
          type: 'broadcast', event: 'signal',
          payload: { type: 'answer', from: profile.id, target: from, sdp: answer },
        })
      } else if (type === 'answer') {
        const pc = peersRef.current[from]
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      } else if (type === 'candidate') {
        const pc = peersRef.current[from]
        if (pc && candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch (e) { /* ignore */ }
        }
      }
    }

    function removePeer(peerId) {
      const pc = peersRef.current[peerId]
      if (pc) { pc.close(); delete peersRef.current[peerId] }
      setRemoteStreams((prev) => { const next = { ...prev }; delete next[peerId]; return next })
      setParticipantNames((prev) => { const next = { ...prev }; delete next[peerId]; return next })
    }

    start()

    return () => {
      cancelled = true
      Object.values(peersRef.current).forEach((pc) => pc.close())
      peersRef.current = {}
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop())
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  function toggleMic() {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled })
    setMicOn((v) => !v)
  }

  function toggleCam() {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled })
    setCamOn((v) => !v)
  }

  const remoteIds = Object.keys(remoteStreams)
  const tileCount = remoteIds.length + 1
  const gridCols = tileCount <= 1 ? 1 : tileCount <= 4 ? 2 : 3

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050f0d', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ring)' }}>
        <div>
          <div className="serif" style={{ fontSize: 16, color: 'var(--gold-bright)' }}>{title || 'Call'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
            {status === 'connecting' && 'Connecting...'}
            {status === 'live' && `${tileCount} in call · in-platform, no external app`}
            {status === 'error' && 'Connection error'}
          </div>
        </div>
      </div>

      {status === 'error' ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <p className="error-text">{errorMsg}</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 8, padding: 12, overflowY: 'auto', alignContent: 'start' }}>
          <div style={{ position: 'relative', background: '#08201b', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3' }}>
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            <span style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 11, background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 6 }}>
              {profile.name} (You)
            </span>
          </div>
          {remoteIds.map((id) => (
            <RemoteTile key={id} stream={remoteStreams[id]} name={participantNames[id] || 'Participant'} />
          ))}
          {status === 'live' && remoteIds.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-soft)', fontSize: 13, padding: 20 }}>
              Waiting for others to join...
            </div>
          )}
        </div>
      )}

      <div style={{ padding: 16, display: 'flex', justifyContent: 'center', gap: 12, borderTop: '1px solid var(--ring)' }}>
        <button onClick={toggleMic} className={micOn ? 'btn-ghost' : 'btn-gold'} style={{ width: 48, height: 48, borderRadius: '50%', fontSize: 18 }}>
          {micOn ? '🎤' : '🔇'}
        </button>
        <button onClick={toggleCam} className={camOn ? 'btn-ghost' : 'btn-gold'} style={{ width: 48, height: 48, borderRadius: '50%', fontSize: 18 }}>
          {camOn ? '📷' : '🚫'}
        </button>
        <button
          onClick={onLeave}
          style={{ width: 48, height: 48, borderRadius: '50%', fontSize: 18, background: '#c0463f', border: 'none', cursor: 'pointer', color: '#fff' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function RemoteTile({ stream, name }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return (
    <div style={{ position: 'relative', background: '#08201b', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3' }}>
      <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <span style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 11, background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 6 }}>
        {name}
      </span>
    </div>
  )
}
