import React, { useRef, useState } from 'react';
import {
  Bookmark,
  Camera,
  Eye,
  EyeOff,
  Flag,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Pin,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { SocialPost, SocialPostCategory, UserAccount } from '../types/society';
import { formatDateTime } from '../utils/format';
import { canCreatePosts, canModeratePosts } from '../utils/permissions';

interface SocialFeedSectionProps {
  posts: SocialPost[];
  currentUser: UserAccount;
  onUploadImage: (dataUrl: string) => Promise<string>;
  onCreatePost: (payload: {
    caption: string;
    category: string;
    imageUrl?: string | null;
  }) => Promise<void>;
  onToggleLike: (postId: string) => Promise<void>;
  onToggleSave: (postId: string) => Promise<void>;
  onAddComment: (postId: string, text: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  onReportPost: (postId: string, reason: string) => Promise<void>;
  onModeratePost: (
    postId: string,
    action: 'pin' | 'unpin' | 'hide' | 'unhide' | 'delete',
    note?: string
  ) => Promise<void>;
}

const POST_CATEGORIES: SocialPostCategory[] = [
  'Home & Decor',
  'Balcony & Garden',
  'Festival Celebration',
  'Community Thought',
  'Buy / Sell / Giveaway',
];

async function readAndCompressImage(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image.'));
    reader.readAsDataURL(file);
  });

  if (file.size <= 1.2 * 1024 * 1024 && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(rawUrl)) {
    return rawUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1280;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(rawUrl);
    img.src = rawUrl;
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export const SocialFeedSection: React.FC<SocialFeedSectionProps> = ({
  posts,
  currentUser,
  onUploadImage,
  onCreatePost,
  onToggleLike,
  onToggleSave,
  onAddComment,
  onDeleteComment,
  onReportPost,
  onModeratePost,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'decor' | 'pinned' | 'saved'>('all');
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<SocialPostCategory>('Home & Decor');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [lightboxPost, setLightboxPost] = useState<SocialPost | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const allowCreate = canCreatePosts(currentUser);
  const allowModerate = canModeratePosts(currentUser);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedError(null);
    setUploading(true);
    try {
      const dataUrl = await readAndCompressImage(file);
      const uploadedUrl = await onUploadImage(dataUrl);
      setImagePreview(uploadedUrl);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Unable to upload photo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim() && !imagePreview) {
      setFeedError('Write a thought or upload a flat/decor photo to share.');
      return;
    }
    setFeedError(null);
    setPublishing(true);
    try {
      await onCreatePost({
        caption: caption.trim(),
        category,
        imageUrl: imagePreview,
      });
      setCaption('');
      setImagePreview(null);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Unable to publish post.');
    } finally {
      setPublishing(false);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (filterTab === 'decor') {
      return p.category === 'Home & Decor' || p.category === 'Balcony & Garden' || p.category === 'Festival Celebration';
    }
    if (filterTab === 'pinned') return p.isPinned;
    if (filterTab === 'saved') return p.savedByMe;
    return true;
  });

  return (
    <section className="space-y-6">
      {/* Section Header + Feed Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-800 dark:text-teal-300">
            Community Wall · Flat Life &amp; Inspiration
          </p>
          <h2 className="mt-0.5 font-display text-xl font-semibold text-slate-900 dark:text-white">
            Society Social Feed
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Share thoughts, flat interiors, balcony gardens, festival decorations, and neighbour tips.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
          {(
            [
              { id: 'all', label: `All (${posts.length})` },
              { id: 'decor', label: 'Flats & Decor' },
              { id: 'pinned', label: 'Pinned' },
              { id: 'saved', label: 'Saved' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                filterTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Post Composer (FB & Instagram-style) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        {allowCreate ? (
          <form onSubmit={handlePublish} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-800 text-xs font-semibold text-white">
                {getInitials(currentUser.name)}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {currentUser.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.flatNumber ? `Flat ${currentUser.flatNumber}` : currentUser.roleTitle}
                    </p>
                  </div>

                  <select
                    aria-label="Post category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SocialPostCategory)}
                    className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    {POST_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share your thoughts, flat decor updates, balcony plants, or festival lights with neighbours..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />

                {imagePreview && (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
                    <img
                      src={imagePreview}
                      alt="Uploaded flat preview"
                      referrerPolicy="no-referrer"
                      className="max-h-72 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="absolute right-2.5 top-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-slate-950/75 text-white hover:bg-slate-950"
                      aria-label="Remove attached photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {feedError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">{feedError}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Camera className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                      <span>{uploading ? 'Uploading...' : 'Add Flat / Decor Photo'}</span>
                    </button>

                    {!imagePreview && (
                      <button
                        type="button"
                        onClick={() =>
                          setImagePreview('/src/assets/images/social_decor_living_1795111778277.jpg')
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>Sample Decor</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={publishing || uploading}
                    className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-5 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{publishing ? 'Posting...' : 'Share Post'}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Post creation is currently disabled for your account by the Society Secretary. You can still like, save, and browse neighbour posts.
            </span>
          </div>
        )}
      </div>

      {/* Social Feed Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {filteredPosts.map((post) => {
          const isAuthor = post.authorUserId === currentUser.id;
          const showComments = Boolean(expandedComments[post.id]) || post.comments.length > 0;
          const canDeletePost = isAuthor || allowModerate;

          return (
            <article
              key={post.id}
              className={`rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden ${
                post.isHidden
                  ? 'border-amber-300 opacity-85 dark:border-amber-800'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Post Header */}
              <div className="p-5 pb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-teal-900 dark:bg-slate-800 dark:text-teal-300">
                    {getInitials(post.authorName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {post.authorName}
                      </p>
                      {post.isPinned && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-800 dark:text-teal-300">
                          <Pin className="h-3 w-3" /> Pinned
                        </span>
                      )}
                      {post.isHidden && (
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          Hidden by Secretary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {post.flatNumber ? `Flat ${post.flatNumber}` : post.authorRoleTitle} · {post.category} ·{' '}
                      {formatDateTime(post.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Secretary Moderation & Delete Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {allowModerate && (
                    <>
                      <button
                        type="button"
                        onClick={() => onModeratePost(post.id, post.isPinned ? 'unpin' : 'pin')}
                        title={post.isPinned ? 'Unpin post' : 'Pin post to top'}
                        className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                          post.isPinned
                            ? 'text-teal-800 bg-teal-50 dark:text-teal-300 dark:bg-teal-950/60'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Pin className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onModeratePost(
                            post.id,
                            post.isHidden ? 'unhide' : 'hide',
                            post.isHidden ? undefined : 'Hidden by Society Secretary'
                          )
                        }
                        title={post.isHidden ? 'Restore post' : 'Hide post from residents'}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-amber-700 dark:hover:bg-slate-800"
                      >
                        {post.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </>
                  )}

                  {canDeletePost && (
                    confirmDeleteId === post.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onModeratePost(post.id, 'delete');
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[32px] rounded-md bg-red-600 px-2.5 text-[11px] font-medium text-white hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[32px] rounded-md px-2 text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(post.id)}
                        title="Delete post"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Caption */}
              {post.caption && (
                <p className="px-5 pb-3.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {post.caption}
                </p>
              )}

              {/* Photo Attachment (Instagram-style 4:3) */}
              {post.imageUrl && !brokenImages[post.id] && (
                <button
                  type="button"
                  onClick={() => setLightboxPost(post)}
                  onDoubleClick={() => onToggleLike(post.id)}
                  className="block w-full aspect-[4/3] bg-slate-100 dark:bg-slate-950 overflow-hidden text-left"
                >
                  <img
                    src={post.imageUrl}
                    alt={`${post.category} shared by ${post.authorName}`}
                    referrerPolicy="no-referrer"
                    onError={() => setBrokenImages((prev) => ({ ...prev, [post.id]: true }))}
                    className="h-full w-full object-cover hover:scale-[1.01] transition-transform duration-300"
                  />
                </button>
              )}

              {post.imageUrl && brokenImages[post.id] && (
                <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <ImageIcon className="h-7 w-7 mb-1" />
                  <span>Flat Photo Attachment</span>
                </div>
              )}

              {/* Interaction Bar */}
              <div className="px-5 py-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onToggleLike(post.id)}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      post.likedByMe
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-600 hover:text-rose-600 dark:text-slate-400'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`} />
                    <span className="font-mono-num">{post.likeCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                    }
                    className="min-h-[38px] inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="font-mono-num">{post.comments.length}</span>
                  </button>

                  {!allowModerate && (
                    <button
                      type="button"
                      onClick={() => setReportingId(reportingId === post.id ? null : post.id)}
                      className="min-h-[38px] inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-700"
                      title="Report post to Secretary"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Report</span>
                    </button>
                  )}

                  {allowModerate && post.reportCount > 0 && (
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 font-mono-num">
                      {post.reportCount} report{post.reportCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onToggleSave(post.id)}
                  className={`min-h-[38px] inline-flex items-center gap-1 text-xs font-medium ${
                    post.savedByMe
                      ? 'text-teal-800 dark:text-teal-300'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  <Bookmark className={`h-4 w-4 ${post.savedByMe ? 'fill-current' : ''}`} />
                  <span>{post.savedByMe ? 'Saved' : 'Save'}</span>
                </button>
              </div>

              {/* Report Reason Input */}
              {reportingId === post.id && (
                <div className="px-5 pb-3 flex gap-2">
                  <input
                    type="text"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Reason for Secretary review..."
                    className="min-h-[36px] flex-1 rounded-lg border border-amber-200 px-3 text-xs dark:border-amber-800 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await onReportPost(post.id, reportReason || 'Flagged for Secretary review');
                      setReportingId(null);
                      setReportReason('');
                    }}
                    className="min-h-[36px] rounded-lg bg-amber-700 px-3 text-xs font-medium text-white"
                  >
                    Send
                  </button>
                </div>
              )}

              {/* Comments Section */}
              {showComments && (
                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 space-y-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                  {post.comments.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-2 text-xs">
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {c.authorName}
                          {c.flatNumber ? ` (${c.flatNumber})` : ''}
                        </span>{' '}
                        {c.text}
                      </p>
                      {(c.userId === currentUser.id || allowModerate) && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(post.id, c.id)}
                          className="shrink-0 text-slate-400 hover:text-red-600 p-1"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const txt = (commentInputs[post.id] || '').trim();
                      if (!txt) return;
                      await onAddComment(post.id, txt);
                      setCommentInputs((prev) => ({ ...prev, [post.id]: '' }));
                    }}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={commentInputs[post.id] || ''}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder="Add a comment..."
                      className="min-h-[36px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-teal-800 text-white hover:bg-teal-900"
                      aria-label="Post comment"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}

        {filteredPosts.length === 0 && (
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No community posts in this filter yet. Share the first flat photo or neighbour thought above.
          </div>
        )}
      </div>

      {/* Lightbox Preview Modal */}
      {lightboxPost && lightboxPost.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxPost(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-slate-900 border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <div className="text-xs">
                <span className="font-semibold">{lightboxPost.authorName}</span>
                {lightboxPost.flatNumber ? ` · Flat ${lightboxPost.flatNumber}` : ''} · {lightboxPost.category}
              </div>
              <button
                type="button"
                onClick={() => setLightboxPost(null)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={lightboxPost.imageUrl}
              alt={lightboxPost.caption || 'Society photo'}
              referrerPolicy="no-referrer"
              className="max-h-[70vh] w-full object-contain bg-black"
            />
            {lightboxPost.caption && (
              <p className="p-4 text-sm text-slate-200">{lightboxPost.caption}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
