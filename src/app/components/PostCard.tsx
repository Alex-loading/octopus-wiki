import { Link } from "react-router";
import { motion } from "motion/react";
import { CalendarDays, Heart, ArrowUpRight, Tag } from "lucide-react";
import { Post } from "../data/posts";
import { ArticleImage } from "./ArticleImage";

const MotionArticleImage = motion.create(ArticleImage);

interface PostCardProps {
  post: Post;
  darkMode: boolean;
  index?: number;
  variant?: "default" | "featured" | "compact";
}

export function PostCard({ post, darkMode, index = 0, variant = "default" }: PostCardProps) {
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
            <MotionArticleImage
              src={post.coverImage}
              alt={post.title}
              loading={index < 2 ? "eager" : "lazy"}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
          <div className="p-5">
            <span className={`mb-1.5 flex items-center gap-1 text-xs font-medium ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
              <Tag size={10} />
              {post.category}
            </span>
            <h2 className={`text-lg leading-snug mb-2 group-hover:text-indigo-500 transition-colors line-clamp-1 ${dm ? "text-white" : "text-gray-900"}`}>
              {post.title}
            </h2>
            <div className="flex items-center justify-between gap-3">
              <time className={`text-xs flex items-center gap-1.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>
                <CalendarDays size={12} />
                {post.date}
              </time>
              <span className={`flex items-center gap-1 text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>
                <Heart size={12} />
                {post.likeCount ?? 0}
              </span>
            </div>
          </div>
        </Link>
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
        <Link to={`/post/${post.slug}`} className="flex min-w-0 items-start gap-4 flex-1">
          <ArticleImage
            src={post.coverImage}
            alt={post.title}
            loading="lazy"
            width={64}
            height={56}
            className="w-16 h-14 object-cover rounded-xl shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className={`text-xs mb-1 block ${dm ? "text-indigo-400" : "text-indigo-600"}`}>{post.category}</span>
            <h3 className={`text-sm font-medium leading-snug line-clamp-1 group-hover:text-indigo-500 transition-colors ${dm ? "text-white" : "text-gray-900"}`}>
              {post.title}
            </h3>
            <time className={`text-xs mt-1 flex items-center gap-1 ${dm ? "text-gray-500" : "text-gray-400"}`}>
              <CalendarDays size={10} />
              {post.date}
            </time>
          </div>
        </Link>
      </motion.article>
    );
  }

  // 默认列表样式
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`group flex gap-3 p-4 sm:gap-5 sm:p-5 rounded-2xl border transition-all ${
        dm
          ? "border-white/5 hover:border-white/10 hover:bg-white/2 bg-gray-900/50"
          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 bg-white"
      }`}
    >
      <Link to={`/post/${post.slug}`} className="flex gap-2 sm:gap-5 flex-1 min-w-0">
        <div className="relative overflow-hidden rounded-xl shrink-0 w-16 h-16 sm:w-28 sm:h-24">
          <MotionArticleImage
            src={post.coverImage}
            alt={post.title}
            loading={index < 3 ? "eager" : "lazy"}
            width={112}
            height={96}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.08 }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-xs font-medium ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
              {post.category}
            </span>
          </div>
          <h3 className={`text-base font-medium leading-snug mb-1.5 line-clamp-1 group-hover:text-indigo-500 transition-colors ${dm ? "text-white" : "text-gray-900"}`}>
            {post.title}
          </h3>
          <time className={`text-xs flex items-center gap-1 whitespace-nowrap ${dm ? "text-gray-500" : "text-gray-400"}`}>
            <CalendarDays size={11} className="shrink-0" />
            {post.date}
          </time>
        </div>
      </Link>

      <div className="flex flex-col items-end justify-between shrink-0">
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          className={`opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg ${dm ? "bg-white/5" : "bg-gray-100"}`}
        >
          <ArrowUpRight size={14} className={dm ? "text-gray-400" : "text-gray-500"} />
        </motion.div>
        <div className={`flex items-center gap-1 text-xs ${dm ? "text-gray-600" : "text-gray-400"}`}>
          <Heart size={12} />
          <span>{post.likeCount ?? 0}</span>
        </div>
      </div>
    </motion.article>
  );
}
