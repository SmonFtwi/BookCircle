"use client";

import { useEffect, useState } from "react";
import { Smartphone, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "./primitives";

const DISMISSED_KEY = "bookcircle:install-guide-dismissed:v1";
const OPEN_EVENT = "bookcircle:open-install-guide";
type Platform = "ios" | "android";

export function InstallGuideButton() {
  return (
    <Button
      variant="outline"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
    >
      <Smartphone /> Add to Home Screen
    </Button>
  );
}

export function InstallGuide() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("ios");

  useEffect(() => {
    const smallScreen = window.matchMedia("(max-width: 767px)");
    const standalone = window.matchMedia("(display-mode: standalone)");
    const iosNavigator = navigator as Navigator & { standalone?: boolean };
    const ios =
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const mobile = ios || /Android/i.test(navigator.userAgent);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      /* Storage may be disabled. */
    }
    const installed = () =>
      standalone.matches || iosNavigator.standalone === true;
    const show = () => {
      setPlatform(
        ios ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "ios",
      );
      setOpen(true);
    };
    const autoShow = () => {
      if (installed()) {
        setOpen(false);
        return;
      }
      if (
        dismissed ||
        (!mobile && !smallScreen.matches) ||
        window.location.pathname.startsWith("/auth/") ||
        window.location.pathname === "/reset-password"
      )
        return;
      if (document.querySelector('[role="dialog"]')) return;
      show();
    };
    const onInstalled = () => {
      dismissed = true;
      setOpen(false);
      try {
        localStorage.setItem(DISMISSED_KEY, "true");
      } catch {
        /* Optional preference. */
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === DISMISSED_KEY && event.newValue === "true") {
        dismissed = true;
        setOpen(false);
      }
    };
    const onDismiss = () => {
      dismissed = true;
    };
    const timer = window.setTimeout(autoShow, 400);
    smallScreen.addEventListener("change", autoShow);
    standalone.addEventListener("change", autoShow);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("storage", onStorage);
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("bookcircle:install-guide-dismissed", onDismiss);
    return () => {
      clearTimeout(timer);
      smallScreen.removeEventListener("change", autoShow);
      standalone.removeEventListener("change", autoShow);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener(
        "bookcircle:install-guide-dismissed",
        onDismiss,
      );
    };
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      /* The guide still closes when storage is unavailable. */
    }
    window.dispatchEvent(new Event("bookcircle:install-guide-dismissed"));
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
      title="Your circle, one tap away."
      description="Save BookCircle to your phone’s Home Screen so your next chapter is always close."
    >
      <div className="install-guide">
        <div className="pill-row" role="group" aria-label="Choose your phone">
          <Button
            variant={platform === "ios" ? "default" : "outline"}
            aria-pressed={platform === "ios"}
            onClick={() => setPlatform("ios")}
          >
            iPhone / iPad
          </Button>
          <Button
            variant={platform === "android" ? "default" : "outline"}
            aria-pressed={platform === "android"}
            onClick={() => setPlatform("android")}
          >
            Android
          </Button>
        </div>
        {platform === "ios" ? (
          <ol className="install-steps">
            <li>
              Open BookCircle in <strong>Safari</strong> on your iPhone or iPad.
            </li>
            <li>
              Tap <Share size={17} aria-hidden="true" className="inline" />{" "}
              <strong>Share</strong>. You may need to open the{" "}
              <strong>More (…)</strong> menu first.
            </li>
            <li>
              Scroll down and choose <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Leave <strong>Open as Web App</strong> on if shown, then tap{" "}
              <strong>Add</strong>.
            </li>
          </ol>
        ) : (
          <ol className="install-steps">
            <li>
              Open BookCircle in <strong>Chrome</strong> on your Android phone.
            </li>
            <li>
              Tap the{" "}
              <MoreVertical size={17} aria-hidden="true" className="inline" />{" "}
              <strong>three-dot menu</strong> beside the address bar.
            </li>
            <li>
              Choose <strong>Install and create shortcut</strong>,{" "}
              <strong>Install app</strong>, or{" "}
              <strong>Add to Home screen</strong>, depending on your Chrome
              version.
            </li>
            <li>
              Tap <strong>Install</strong> or <strong>Add</strong> to confirm.
            </li>
          </ol>
        )}
        <p className="meta">
          Opened a link inside another app? Open it in{" "}
          {platform === "ios" ? "Safari" : "Chrome"} first. You can find this
          guide again in My profile.
        </p>
        <Button className="w-full" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}
