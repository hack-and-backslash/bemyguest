/* eslint-disable @next/next/no-img-element -- illustrated SVG backdrop */
import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { wedding } from "@/content/wedding";
import { getViewer } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { formatDateSpan } from "@/lib/format";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Welcome" };

// Drop Google's official "G" mark here (see SETUP.md) and the button shows it.
const hasGoogleMark = existsSync(path.join(process.cwd(), "public", "brand", "google-g.svg"));

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getViewer()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-sand-100">
      <img
        src="/illustrations/scene-hero.svg"
        alt="Illustrated clifftop lawn at golden hour: wooden cottages under big shady trees, stone steps down to the beach and the sun setting into the sea"
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
      />
      <img src="/illustrations/cloud.svg" alt="" className="animate-drift absolute top-16 left-[6%] w-40 opacity-90 lg:top-10 lg:left-[36%] lg:w-64" />
      <img
        src="/illustrations/cloud.svg"
        alt=""
        className="animate-drift absolute top-24 left-[60%] hidden w-52 opacity-80 [animation-direction:alternate-reverse] [animation-duration:28s] lg:block"
      />

      <p className="absolute top-5 left-5 font-script text-[22px] font-bold lg:top-8 lg:left-12 lg:text-[26px]">
        {wedding.monogram}
      </p>

      <div className="relative z-10 flex min-h-dvh flex-col items-center px-3 pt-[14dvh] pb-4 text-center lg:pt-[120px] lg:pb-12">
        <p className="kicker animate-fade-up mb-2 text-[22px] text-sea-700 lg:mb-3 lg:text-[30px]">
          Pack your sunnies — you&apos;re invited!
        </p>
        <h1 className="animate-fade-up flex flex-col items-center font-serif text-[46px] leading-[1.02] [text-shadow:0_0_22px_rgb(251_245_234/0.95),0_0_6px_rgb(251_245_234/0.8)] [animation-delay:150ms] lg:text-[76px] lg:leading-none">
          <span>{wedding.partnerA}</span>
          <span className="font-script text-[34px] leading-[1.1] text-coral-600 lg:text-[52px]">&amp;</span>
          <span>{wedding.partnerB}</span>
        </h1>
        <p className="animate-fade-up mt-4 text-base font-semibold [text-shadow:0_0_12px_rgb(251_245_234/0.95)] [animation-delay:150ms] lg:mt-6 lg:text-xl">
          {formatDateSpan()} · {wedding.place}
        </p>

        <section
          aria-labelledby="signin-title"
          className="animate-fade-up mt-auto flex w-full max-w-[520px] flex-col gap-4 rounded-[28px] bg-sand-50/95 px-6 pt-6 pb-5 shadow-[0_18px_50px_rgb(31_58_61/0.16)] [animation-delay:300ms] lg:mt-12 lg:mb-auto lg:gap-[18px] lg:px-10 lg:pt-8 lg:pb-7"
        >
          <h2 id="signin-title" className="font-serif text-2xl lg:text-[28px]">
            Hey there! Come on in.
          </h2>
          <p className="text-base leading-relaxed text-pretty text-ink-soft lg:text-[17px]">
            We&apos;re throwing a two-day party on a clifftop by the sea in Goa, and it won&apos;t be the same without you.
            Sign in so we know it&apos;s you.
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-coral-200 px-4 py-3 text-[15px] font-semibold text-coral-800">
              Sign-in didn&apos;t go through. Mind trying once more?
            </p>
          )}
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="btn w-full border-[1.5px] border-[#d8c7a6] bg-white text-lg text-ink hover:text-ink"
            >
              {hasGoogleMark && <img src="/brand/google-g.svg" alt="" width={22} height={22} />}
              Continue with Google
            </button>
          </form>
          <p className="text-[13px] leading-normal text-ink-soft">
            {isDemo
              ? "Demo mode: this signs you in as Sam with sample data."
              : "We only use your name and photo to say hi and put you on the guest wall."}
          </p>
        </section>
      </div>
    </main>
  );
}
