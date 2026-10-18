/** The one place the panel imports Lucide from; screens and the editor use these. */
import type { LucideIcon } from 'lucide-react';

export {
  BookOpen,
  BookOpenText,
  Bold,
  Ellipsis,
  ExternalLink,
  FileText,
  Highlighter,
  House,
  IdCard,
  Image,
  Italic,
  LayoutTemplate,
  Link,
  List,
  ListOrdered,
  LogOut,
  Mail,
  Moon,
  Plus,
  Quote,
  Redo2,
  Scale,
  Search,
  Share2,
  Strikethrough,
  Sun,
  Tags,
  Undo2,
  UserRound,
  SquarePlay as Youtube, // Lucide 1.x dropped brand icons; a play square stands in
} from 'lucide-react';
export type { LucideIcon };

/** Thin wrapper: decorative (`aria-hidden`) unless a `label` is given. */
export function Icon({ as: Glyph, size = 18, label }: { as: LucideIcon; size?: number; label?: string }) {
  return <Glyph className="nav-icon" size={size} strokeWidth={1.8} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} />;
}
