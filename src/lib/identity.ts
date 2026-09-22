"use client";

/** ログインなしで使うので、ルームごとの member id と表示名を端末に残す（SPEC F1）。 */

const NAME_KEY = "kakomon.displayName";
const memberKey = (roomId: string) => `kakomon.member.${roomId}`;

export function getDisplayName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setDisplayName(name: string) {
  window.localStorage.setItem(NAME_KEY, name);
}

export function getMemberId(roomId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(memberKey(roomId));
}

export function setMemberId(roomId: string, memberId: string) {
  window.localStorage.setItem(memberKey(roomId), memberId);
}

const DEVICE_KEY = "kakomon.deviceId";

/**
 * 部屋をまたいだ履歴（F10）を繋ぐための端末ごとの匿名 id。
 * ログインしないので、端末を変えると履歴は引き継がれない。
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
