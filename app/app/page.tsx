import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Provider } from "@/generated/prisma/enums";
const platforms: {
  name: string;
  provider: Provider;
  href: string;
}[] = [
  {
    name: "YouTube",
    provider: Provider.YOUTUBE,
    href: "/api/youtube/connect",
  },
  {
    name: "Instagram",
    provider: Provider.INSTAGRAM,
    href: "/api/instagram/connect",
  },
  {
    name: "LinkedIn",
    provider: Provider.LINKEDIN,
    href: "/api/linkedin/connect",
  },
  {
    name: "X (Twitter)",
    provider: Provider.X,
    href: "/api/x/connect",
  },
];

export default async function Home() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    include: {
      socialAccounts: true,
    },
  });

  const connectedAccounts = new Set(
    currentUser?.socialAccounts.map((account) => account.provider)
  );

  return (
    <main className="min-h-screen p-10">
      <h1 className="text-3xl font-bold">
        Welcome {session.user.name}
      </h1>

      <p className="mt-2 text-gray-600">Connected Accounts</p>

      <div className="mt-10 space-y-6">
        {platforms.map((platform) => {
          const connected = connectedAccounts.has(platform?.provider);

          return (
            <div
              key={platform.provider}
              className="flex items-center justify-between border p-4 rounded-lg"
            >
              <span>
                {connected ? "✅" : "❌"} {platform.name}
              </span>

              <Link href={platform.href}>
                <button
                  disabled={connected}
                  className={`border px-4 py-2 rounded ${
                    connected
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {connected ? "Connected" : "Connect"}
                </button>
              </Link>
            </div>
          );
        })}
      </div>
    </main>
  );
}