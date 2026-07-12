"use client";

import { useEffect, useState } from "react";

type Account = {
  id: string;
  provider: string;
};

interface Props {
  selectedPlatforms: string[];
  setSelectedPlatforms: React.Dispatch<
    React.SetStateAction<string[]>
  >;
}

export default function AddedMedias({
  selectedPlatforms,
  setSelectedPlatforms,
}: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    fetch("/api/socialAccounts")
      .then((res) => res.json())
      .then((data: Account[]) => {
        setAccounts(data);

        setSelectedPlatforms(
          data.map((item) => item.provider)
        );
      });
  }, []);

  const toggle = (provider: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
    );
  };

  return (
    <div className="mb-8 flex flex-wrap gap-3">
      {accounts.map((account) => {
        const active = selectedPlatforms.includes(
          account.provider
        );

        return (
          <button
            key={account.id}
            onClick={() => toggle(account.provider)}
            className={`rounded-full px-5 py-2 transition ${
              active
                ? "bg-black text-white"
                : "bg-gray-200"
            }`}
          >
            {account.provider}
          </button>
        );
      })}
    </div>
  );
}