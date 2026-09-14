import Link from "next/link";
import { HeartIcon } from "./ui";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center">
            <HeartIcon className="w-3.5 h-3.5" />
          </div>
          <span>Care Coordinator</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-slate-500">
          <Link href="/about" className="hover:text-teal-600 transition-colors">
            About
          </Link>
          <Link href="/contact" className="hover:text-teal-600 transition-colors">
            Contact
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} Care Coordinator
        </p>
      </div>
    </footer>
  );
}
