import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  const currUser = await prisma.user.findFirst({
    where: {
      id: session?.user?.id,
    },
  });
  const accounts = await prisma.socialAccount.findMany({
    where:{
        userId: currUser?.id
    }
  });

  console.log(accounts, "Connected Accounts");

  return NextResponse.json(accounts);
}