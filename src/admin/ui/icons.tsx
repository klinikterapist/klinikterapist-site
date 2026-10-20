/** The one place the panel imports Lucide from; screens and the editor use these. */
import type { LucideIcon } from 'lucide-react';

export {
  BookOpen,
  BookOpenText,
  CalendarCheck,
  CalendarDays,
  Bold,
  CircleCheck as CheckCircle2, // Lucide 1.x renamed it
  CircleCheck,
  Ellipsis,
  ExternalLink,
  FileText,
  Highlighter,
  House,
  IdCard,
  Image,
  Inbox,
  Italic,
  LayoutTemplate,
  Link,
  List,
  ListOrdered,
  LogOut,
  Mail,
  Menu,
  MessageCircleQuestion,
  Moon,
  Plus,
  Quote,
  Redo2,
  Scale,
  Search,
  SearchCheck,
  Settings,
  Share2,
  Strikethrough,
  Sun,
  Tag,
  Tags,
  Trash2,
  Undo2,
  UserRound,
  SquarePlay as Youtube, // Lucide 1.x dropped brand icons; a play square stands in
} from 'lucide-react';
export type { LucideIcon };

/** Thin wrapper: decorative (`aria-hidden`) unless a `label` is given. */
export function Icon({ as: Glyph, size = 18, label }: { as: LucideIcon; size?: number; label?: string }) {
  return <Glyph className="nav-icon" size={size} strokeWidth={1.8} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} />;
}
