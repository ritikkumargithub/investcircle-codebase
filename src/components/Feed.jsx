import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function fmtTime(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function PostCard({ post, profile, myLikedSet, onToggleLike }) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const liked = myLikedSet.has(post.id)

  async function loadComments() {
    const { data } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setCommentsLoaded(true)
  }

  async function toggleShowComments() {
    const next = !showComments
    setShowComments(next)
    if (next && !commentsLoaded) await loadComments()
  }

  async function handleAddComment() {
    if (!newComment.trim()) return
    setPosting(true)
    const { error } = await supabase.from('post_comments').insert({
      post_id: post.id,
      author_id: profile.id,
      author_name: profile.name,
      content: newComment.trim(),
    })
    setPosting(false)
    if (!error) {
      setNewComment('')
      setCommentCount((c) => c + 1)
      loadComments()
    }
  }

  async function handleLike() {
    const wasLiked = liked
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1))
    await onToggleLike(post.id, wasLiked)
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{post.author_name}</span>
          {post.author_specialization && (
            <span className="badge badge-gold" style={{ marginLeft: 6 }}>{post.author_specialization}</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>{fmtTime(post.created_at)}</span>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>{post.content}</p>
      <span className="badge" style={{ marginBottom: 10, display: 'inline-block' }}>Educational — not personalized advice</span>

      <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--ring)' }}>
        <button
          onClick={handleLike}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
            color: liked ? 'var(--gold-bright)' : 'var(--text-soft)', fontWeight: liked ? 700 : 500,
            display: 'flex', alignItems: 'center', gap: 5, padding: 0,
          }}
        >
          {liked ? '★' : '☆'} {likeCount > 0 ? likeCount : ''} Like{likeCount === 1 ? '' : 's'}
        </button>
        <button
          onClick={toggleShowComments}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
            color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: 5, padding: 0,
          }}
        >
          💬 {commentCount > 0 ? commentCount : ''} Comment{commentCount === 1 ? '' : 's'}
        </button>
      </div>

      {showComments && (
        <div className="fade-in" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ring)' }}>
          {!commentsLoaded && <p style={{ fontSize: 12, color: 'var(--text-soft)' }}>Loading comments...</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {comments.map((c) => (
              <div key={c.id} style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{c.author_name}</span>{' '}
                <span style={{ color: 'var(--text-soft)' }}>{c.content}</span>
              </div>
            ))}
            {commentsLoaded && comments.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-soft)' }}>No comments yet. Be the first.</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment() }}
            />
            <button
              onClick={handleAddComment}
              disabled={posting}
              className="btn-gold"
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, whiteSpace: 'nowrap' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Feed({ profile }) {
  const [posts, setPosts] = useState([])
  const [myLikedSet, setMyLikedSet] = useState(new Set())
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: postRows } = await supabase
      .from('posts')
      .select('*, post_likes(count), post_comments(count)')
      .order('created_at', { ascending: false })
      .limit(50)

    const shaped = (postRows || []).map((p) => ({
      ...p,
      likeCount: p.post_likes?.[0]?.count || 0,
      commentCount: p.post_comments?.[0]?.count || 0,
    }))
    setPosts(shaped)

    const { data: myLikes } = await supabase.from('post_likes').select('post_id').eq('user_id', profile.id)
    setMyLikedSet(new Set((myLikes || []).map((l) => l.post_id)))

    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('feed-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleToggleLike(postId, wasLiked) {
    setMyLikedSet((prev) => {
      const next = new Set(prev)
      if (wasLiked) next.delete(postId); else next.add(postId)
      return next
    })
    if (wasLiked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', profile.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: profile.id })
    }
  }

  async function handlePost() {
    if (!content.trim()) return
    setPosting(true)
    const { error } = await supabase.from('posts').insert({
      author_id: profile.id,
      author_name: profile.name,
      author_specialization: profile.specialization,
      content: content.trim(),
    })
    setPosting(false)
    if (!error) setContent('')
  }

  return (
    <div className="fade-in">
      {profile.role === 'ps' && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share market news or education with your followers..."
            rows={3}
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="badge">Educational — not personalized advice</span>
            <button
              onClick={handlePost}
              disabled={posting}
              className="btn-gold"
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 14 }}
            >
              Post
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0' }}>Loading...</p>}

      {!loading && posts.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: '40px 0', fontSize: 14 }}>
          No posts yet. Advisors' updates will show up here.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} profile={profile} myLikedSet={myLikedSet} onToggleLike={handleToggleLike} />
        ))}
      </div>
    </div>
  )
}
