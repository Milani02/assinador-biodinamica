"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  // O React nem sempre aplica o atributo `muted` no DOM no 1o render, e o
  // Chrome bloqueia o autoplay de video "com som". Forcamos muted + play().
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    // Respeita quem prefere menos movimento: mantem o poster estatico.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    v.addEventListener("canplay", tryPlay);
    // Se o autoplay foi adiado (aba aberta em 2o plano), toca ao ficar visivel.
    const onVis = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      v.removeEventListener("canplay", tryPlay);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Login OK: navega (soft -> mostra o skeleton na hora) e força o refetch dos
  // Server Components com a sessão nova (router.refresh), evitando o painel vazio.
  useEffect(() => {
    if (state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [state.redirectTo, router]);

  const busy = pending || Boolean(state.redirectTo);

  return (
    // Tela de marca: sempre clara (não inverte no dark mode do resto do app).
    <main className="relative flex min-h-[100svh] w-full flex-col overflow-x-hidden bg-[#fefefe] text-[#141414] lg:grid lg:grid-cols-[1.33fr_1fr] lg:overflow-hidden">
      {/* Painel da imagem (falcao) — poster como background garante pintura
          imediata (sem flash branco) antes do <video> decodificar. */}
      <section className="relative h-[clamp(252px,36svh,320px)] w-full shrink-0 overflow-hidden bg-[#d7d3cc] bg-[url(/signing-poster.jpg?v=5)] bg-cover bg-[position:50%_42%] lg:h-full">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover object-[50%_42%]"
          muted
          loop
          playsInline
          preload="auto"
          poster="/signing-poster.jpg?v=5"
          aria-label="Pessoa assinando um documento"
        >
          <source src="/signing.mp4?v=5" type="video/mp4" />
        </video>

        {/* Scrim: so no mobile, para o texto branco ler sobre a foto */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgba(7,10,13,0.02)] via-[rgba(7,10,13,0.14)] to-[rgba(7,10,13,0.78)] lg:hidden" />

        {/* Hero: headline ancorado embaixo a esquerda */}
        <div className="absolute inset-x-0 bottom-0 flex animate-in flex-col items-start gap-3 px-5 pb-10 pt-5 duration-700 fade-in slide-in-from-bottom-4 lg:gap-6 lg:p-11">
          <h2 className="max-w-[12ch] text-[clamp(30px,6.4vw,66px)] font-semibold leading-[1.02] tracking-[-0.03em] text-white [font-family:var(--font-eloquia)] [text-shadow:0_2px_18px_rgba(0,0,0,0.32)] lg:text-black lg:[text-shadow:0_1px_2px_rgba(255,255,255,0.55),0_0_18px_rgba(255,255,255,0.42)]">
            Aprove e assine
            <br />
            em minutos
          </h2>
        </div>
      </section>

      {/* Painel do formulario — no mobile vira um "bottom sheet" que sobe sobre
          a midia e preenche ate a base; no desktop (lg) e um card centralizado. */}
      <section className="relative z-10 flex flex-1 flex-col lg:items-center lg:justify-center lg:p-6">
        <div className="-mt-6 flex w-full flex-1 flex-col rounded-t-[26px] bg-white px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-9 shadow-[0_-12px_30px_rgba(20,28,36,0.10)] animate-in duration-700 fade-in slide-in-from-bottom-4 lg:mt-0 lg:max-w-[460px] lg:flex-none lg:rounded-[26px] lg:border lg:border-black/[0.05] lg:bg-white/90 lg:px-9 lg:py-9 lg:shadow-[1px_10px_14px_rgba(10,14,20,0.14),0_1px_3px_rgba(10,14,20,0.05)] lg:backdrop-blur-xl lg:zoom-in-95">
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center lg:max-w-[380px] lg:flex-none lg:justify-start">
            <BrandLogo className="mb-8 h-7 self-center text-[#283139]" />
            <h1 className="text-center text-[clamp(30px,6vw,40px)] font-semibold tracking-[-0.04em] text-[#2c3343] [font-family:var(--font-eloquia)]">
              Bem-vindo de volta!
            </h1>
            <p className="mt-3 text-center text-[clamp(15px,2.4vw,19px)] leading-snug text-[#797979]">
              <b className="font-bold text-[#5b5b5b]">Faça login</b> para continuar
              aprovando os documentos do SGQ.
            </p>

            <form action={formAction} className="mt-7 flex flex-col gap-3.5">
              <label htmlFor="email" className="sr-only">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                placeholder="seu@email.com"
                className="h-[58px] rounded-xl border border-[#acacae] bg-[#fafafa] px-4 text-[16px] text-[#141414] outline-none placeholder:text-[#606060] focus-visible:border-[#283139] focus-visible:ring-2 focus-visible:ring-[#283139]/40 lg:text-[15px]"
              />

              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Senha"
                className="h-[58px] rounded-xl border border-[#e3e3e5] bg-[#f6f6f7] px-4 text-[16px] text-[#141414] outline-none placeholder:text-[#606060] focus-visible:border-[#283139] focus-visible:ring-2 focus-visible:ring-[#283139]/40"
              />

              {state.error && (
                <p role="alert" className="text-sm font-medium text-[#c0392b]">
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group mt-2 flex h-[60px] items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-[#283139] to-[#293340] text-[16px] font-medium text-white shadow-[0_8px_20px_rgba(18,26,34,0.16),0_2px_5px_rgba(18,26,34,0.10)] transition-[filter,transform] duration-200 hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? "Entrando..." : "Entrar"}
                {!busy && (
                  <ArrowRight
                    className="size-[18px] transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2.6}
                  />
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-[14px] text-[#0a0a0a]/65">
              Acesso restrito aos usuários cadastrados.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
