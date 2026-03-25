import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Clock, Heart, Bookmark, ArrowUpRight, Tag } from "lucide-react";
import { Post } from "../data/posts";

interface PostCardProps {
  post: Post;
  darkMode: boolean;
  index?: number;
  variant?: "default" | "featured" | "compact";
}

export function PostCard({ post, darkMode, index = 0, variant = "default" }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount] = useState(Math.floor(Math.random() * 80) + 12);
  const dm = darkMode;

  if (variant === "featured") {
    return (
      <motion.article
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
        className={`group relative overflow-hidden rounded-2xl ${
          dm ? "bg-gray-900 border border-white/5" : "bg-white border border-gray-100 shadow-sm"
        }`}
      >
        <Link to={`/post/${post.slug}`} className="block">
          <div className="relative h-56 overflow-hidden">
            <motion.img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute top-3 left-3">
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-medium ${
                dm ? "bg-indigo-500/80 text-white" : "bg-indigo-600 text-white"
              }`}>
                <Tag size={10} />
                {post.category}
              </span>
            </div>
          </div>
          <div className="p-5">
            <h2 className={`text-lg leading-snug mb-2 group-hover:text-indigo-500 transition-colors line-clamp-2 ${dm ? "text-white" : "text-gray-900"}`}>
              {post.title}
            </h2>
            <p className={`text-sm leading-relaxed line-clamp-2 mb-4 ${dm ? "text-gray-400" : "text-gray-500"}`}>
              {post.excerpt}
            </p>
            <div className="flex items-center gap-3">
              <span className={`text-xs flex items-center gap-1.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>
                <Clock size={12} />
                {post.readTime} 分钟阅读
              </span>
              <span className={`text-xs ${dm ? "text-gray-600" : "text-gray-300"}`}>·</span>
              <span className={`text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>{post.date}</span>
            </div>
          </div>
        </Link>

        {/* Actions */}
        <div className={`px-5 pb-4 flex items-center justify-between border-t ${dm ? "border-white/5" : "border-gray-50"} pt-3`}>
          <div className="flex items-center gap-1">
            {post.tags.slice(0, 2).map((tag) => (
              <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${dm ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-500"}`}>
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={(e) => { e.preventDefault(); setLiked(!liked); }}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                liked
                  ? "text-rose-500"
                  : dm ? "text-gray-500 hover:text-rose-400" : "text-gray-400 hover:text-rose-500"
              }`}
            >
              <motion.div animate={{ scale: liked ? [1, 1.4, 1] : 1 }} transition={{ duration: 0.3 }}>
                <Heart size={12} fill={liked ? "currentColor" : "none"} />
              </motion.div>
              <span>{likeCount + (liked ? 1 : 0)}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={(e) => { e.preventDefault(); setBookmarked(!bookmarked); }}
              className={`p-1 rounded-lg transition-colors ${
                bookmarked
                  ? "text-indigo-500"
                  : dm ? "text-gray-500 hover:text-indigo-400" : "text-gray-400 hover:text-indigo-500"
              }`}
            >
              <Bookmark size={12} fill={bookmarked ? "currentColor" : "none"} />
            </motion.button>
          </div>
        </div>
      </motion.article>
    );
  }

  if (variant === "compact") {
    return (
      <motion.article
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: index * 0.08 }}
        className={`group flex items-start gap-4 p-4 rounded-xl transition-colors cursor-pointer ${
          dm ? "hover:bg-white/5" : "hover:bg-gray-50"
        }`}
      >
        <Link to={`/post/${post.slug}`} className="flex items-start gap-4 flex-1">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-16 h-14 object-cover rounded-xl shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className={`text-xs mb-1 block ${dm ? "text-indigo-400" : "text-indigo-600"}`}>{post.category}</span>
            <h3 className={`text-sm font-medium leading-snug line-clamp-2 group-hover:text-indigo-500 transition-colors ${dm ? "text-white" : "text-gray-900"}`}>
              {post.title}
            </h3>
            <span className={`text-xs mt-1 flex items-center gap-1 ${dm ? "text-gray-500" : "text-gray-400"}`}>
              <Clock size={10} />
              {post.readTime} 分钟
            </span>
          </div>
        </Link>
      </motion.article>
    );
  }

  // Default variant
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`group flex gap-5 p-5 rounded-2xl border transition-all ${
        dm
          ? "border-white/5 hover:border-white/10 hover:bg-white/2 bg-gray-900/50"
          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 bg-white"
      }`}
    >
      <Link to={`/post/${post.slug}`} className="flex gap-5 flex-1 min-w-0">
        <div className="relative overflow-hidden rounded-xl shrink-0 w-28 h-24">
          <motion.img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.08 }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-xs font-medium ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
              {post.category}
            </span>
            <span className={`text-xs ${dm ? "text-gray-600" : "text-gray-300"}`}>·</span>
            <span className={`text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>{post.date}</span>
          </div>
          <h3 className={`text-base font-medium leading-snug mb-1.5 line-clamp-1 group-hover:text-indigo-500 transition-colors ${dm ? "text-white" : "text-gray-900"}`}>
            {post.title}
          </h3>
          <p className={`text-sm line-clamp-2 leading-relaxed ${dm ? "text-gray-400" : "text-gray-500"}`}>
            {post.excerpt}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs flex items-center gap-1 ${dm ? "text-gray-500" : "text-gray-400"}`}>
              <Clock size={11} />
              {post.readTime} 分钟
            </span>
            <div className="flex gap-1">
              {post.tags.slice(0, 2).map((tag) => (
                <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-md ${dm ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-400"}`}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Link>

      <div className="flex flex-col items-end justify-between shrink-0">
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          className={`opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg ${dm ? "bg-white/5" : "bg-gray-100"}`}
        >
          <ArrowUpRight size={14} className={dm ? "text-gray-400" : "text-gray-500"} />
        </motion.div>
        <div className="flex flex-col items-end gap-2">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => setLiked(!liked)}
            className={`flex items-center gap-1 text-xs transition-colors ${
              liked ? "text-rose-500" : dm ? "text-gray-600 hover:text-rose-400" : "text-gray-400 hover:text-rose-500"
            }`}
          >
            <motion.div animate={{ scale: liked ? [1, 1.4, 1] : 1 }} transition={{ duration: 0.3 }}>
              <Heart size={12} fill={liked ? "currentColor" : "none"} />
            </motion.div>
            <span>{likeCount + (liked ? 1 : 0)}</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => setBookmarked(!bookmarked)}
            className={`transition-colors ${
              bookmarked ? "text-indigo-500" : dm ? "text-gray-600 hover:text-indigo-400" : "text-gray-400 hover:text-indigo-500"
            }`}
          >
            <Bookmark size={12} fill={bookmarked ? "currentColor" : "none"} />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
