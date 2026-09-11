import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const EMOJI_GROUPS: { key: string; label: string; emojis: string[] }[] = [
  {
    key: "smileys",
    label: "😀",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "🥲",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤗",
      "🤭",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "😮‍💨",
      "🤥",
      "😌",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🥳",
      "🥺",
      "😢",
      "😭",
      "😤",
      "😠",
      "😡",
      "🤯",
      "😳",
      "🥶",
      "🥵",
      "😱",
      "😨",
      "😰",
      "😥",
      "🤠",
    ],
  },
  {
    key: "gestures",
    label: "👍",
    emojis: [
      "👍",
      "👎",
      "👌",
      "🤌",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "👇",
      "☝️",
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "👏",
      "🙌",
      "🤝",
      "🙏",
      "💪",
      "🦾",
      "✍️",
      "💅",
      "👀",
      "🧠",
      "👶",
      "🧑",
      "👩",
      "👨",
      "🧓",
      "🕺",
      "💃",
      "🙋",
      "🤷",
      "🤦",
      "🧘",
      "🏃",
      "🚶",
    ],
  },
  {
    key: "hearts",
    label: "❤️",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💯",
      "✨",
      "⭐",
      "🌟",
      "💫",
      "🔥",
      "🎉",
      "🎊",
      "🎈",
      "🎁",
      "🏆",
      "🥇",
      "👑",
      "💎",
    ],
  },
  {
    key: "nature",
    label: "🌿",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🐔",
      "🦄",
      "🐝",
      "🦋",
      "🐢",
      "🐙",
      "🐬",
      "🐳",
      "🌵",
      "🌲",
      "🌳",
      "🌴",
      "🌱",
      "🌿",
      "☘️",
      "🍀",
      "🌸",
      "🌼",
      "🌻",
      "🌞",
      "🌝",
      "🌙",
      "⚡",
      "☀️",
      "🌈",
      "☁️",
      "❄️",
      "🌊",
      "🍄",
    ],
  },
  {
    key: "food",
    label: "🍕",
    emojis: [
      "🍏",
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🥑",
      "🥦",
      "🌽",
      "🥕",
      "🍞",
      "🧀",
      "🥚",
      "🍔",
      "🍟",
      "🍕",
      "🌭",
      "🌮",
      "🌯",
      "🍜",
      "🍣",
      "🍱",
      "🍰",
      "🎂",
      "🍩",
      "🍪",
      "🍫",
      "🍿",
      "☕",
      "🍵",
      "🧋",
      "🍺",
      "🥂",
    ],
  },
  {
    key: "objects",
    label: "💡",
    emojis: [
      "💡",
      "📱",
      "💻",
      "⌨️",
      "🖥️",
      "🖨️",
      "🎧",
      "🎤",
      "📷",
      "🎥",
      "📚",
      "📖",
      "📝",
      "✏️",
      "📌",
      "📎",
      "📊",
      "📈",
      "📉",
      "🗂️",
      "🗓️",
      "⏰",
      "⌛",
      "🔒",
      "🔑",
      "🔍",
      "🔔",
      "💰",
      "💳",
      "🚀",
      "✈️",
      "🚗",
      "🏠",
      "🏢",
      "🌍",
      "⚽",
      "🏀",
      "🎮",
      "🎯",
      "🎵",
      "🎬",
      "🧪",
      "🔬",
      "⚙️",
    ],
  },
];

export function EmojiPicker({
  onSelect,
  className,
  triggerClassName,
  asChildTrigger,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
  triggerClassName?: string;
  asChildTrigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = (emojis: string[]) => emojis;
  const allEmojis = EMOJI_GROUPS.flatMap((g) => g.emojis);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {asChildTrigger ?? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Insert emoji"
            className={cn("h-8 w-8 text-muted-foreground", triggerClassName)}
          >
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-[300px] p-2", className)}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji"
          className="mb-2 h-8 text-xs"
        />
        {query.trim() ? (
          <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
            {allEmojis
              .filter((e) => e.includes(query.trim()))
              .map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  className="rounded-md p-1 text-lg hover:bg-accent"
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
          </div>
        ) : (
          <Tabs defaultValue={EMOJI_GROUPS[0]!.key}>
            <TabsList className="grid w-full grid-cols-6">
              {EMOJI_GROUPS.map((group) => (
                <TabsTrigger key={group.key} value={group.key} className="text-base">
                  {group.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {EMOJI_GROUPS.map((group) => (
              <TabsContent key={group.key} value={group.key}>
                <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
                  {filtered(group.emojis).map((emoji, i) => (
                    <button
                      key={`${emoji}-${i}`}
                      type="button"
                      className="rounded-md p-1 text-lg hover:bg-accent"
                      onClick={() => {
                        onSelect(emoji);
                        setOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}
