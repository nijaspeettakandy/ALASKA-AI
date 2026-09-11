import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Phone, Sparkles, Users } from "lucide-react";
import { AlaskaWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alaska AI — Assistant, chat and research stories" },
      {
        name: "description",
        content:
          "Alaska AI pairs a personal AI assistant with messenger-style chat, calls and 24-hour research stories you share with friends.",
      },
      { property: "og:title", content: "Alaska AI — Assistant, chat and research stories" },
      {
        property: "og:description",
        content:
          "Alaska AI pairs a personal AI assistant with messenger-style chat, calls and 24-hour research stories you share with friends.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Sparkles,
    title: "Alaska Assistant",
    body: "A threaded AI companion that remembers every conversation in your account.",
  },
  {
    icon: MessageCircle,
    title: "Personal & group chat",
    body: "Message friends one-to-one or in groups, in real time.",
  },
  { icon: Phone, title: "Voice & video", body: "Ring a friend straight from any conversation." },
  {
    icon: Users,
    title: "Research stories",
    body: "Post an update, friends watch it for 24 hours, then it melts away.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <AlaskaWordmark />
        <Button asChild variant="ghost">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="relative overflow-hidden px-6 pb-24 pt-12">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-25 blur-3xl bg-aurora-gradient"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI assistant + social layer
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.05] sm:text-6xl">
            Think with <span className="text-aurora">Alaska AI</span>. Share it with your people.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            One place to ask anything, chat and call your friends, and publish the research updates
            you want them to see.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2 shadow-glow">
              <Link to="/auth">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto mt-20 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <feature.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
