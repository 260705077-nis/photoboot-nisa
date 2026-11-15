import type { RowDataPacket } from "@/lib/db";
import type { Download, Filter, Frame, Photo, PhotoSession, PhotoStrip, User } from "@/lib/types";

type Row = RowDataPacket;

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function mapUser(row: Row): User {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role === "ADMIN" ? "ADMIN" : "USER",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapFrame(row: Row): Frame {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: nullableString(row.description),
    imageUrl: String(row.image_url),
    slotCount: Number(row.slot_count) === 3 ? 3 : 4,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapFilter(row: Row): Filter {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: nullableString(row.description),
    cssFilter: String(row.css_filter),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapSession(row: Row): PhotoSession {
  return {
    id: Number(row.id),
    sessionCode: String(row.session_code),
    userId: row.user_id === null ? null : Number(row.user_id),
    frameId: row.frame_id === null ? null : Number(row.frame_id),
    filterId: row.filter_id === null ? null : Number(row.filter_id),
    photoCount: Number(row.photo_count) === 3 ? 3 : 4,
    status:
      row.status === "COMPLETED" ? "COMPLETED" : row.status === "CANCELLED" ? "CANCELLED" : "ACTIVE",
    createdAt: String(row.created_at),
    completedAt: nullableString(row.completed_at),
    updatedAt: String(row.updated_at),
    userName: nullableString(row.user_name),
    frameName: nullableString(row.frame_name),
    filterName: nullableString(row.filter_name),
  };
}

export function mapPhoto(row: Row): Photo {
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id),
    position: Number(row.position),
    imageUrl: String(row.image_url),
    createdAt: String(row.created_at),
    sessionCode: nullableString(row.session_code) ?? undefined,
  };
}

export function mapStrip(row: Row): PhotoStrip {
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id),
    frameId: row.frame_id === null ? null : Number(row.frame_id),
    filterId: row.filter_id === null ? null : Number(row.filter_id),
    imageUrl: String(row.image_url),
    caption: nullableString(row.caption),
    isPublic: Boolean(row.is_public),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    sessionCode: nullableString(row.session_code) ?? undefined,
    userName: nullableString(row.user_name),
    frameName: nullableString(row.frame_name),
    filterName: nullableString(row.filter_name),
  };
}

export function mapDownload(row: Row): Download {
  return {
    id: Number(row.id),
    photoStripId: Number(row.photo_strip_id),
    userId: row.user_id === null ? null : Number(row.user_id),
    createdAt: String(row.created_at),
    imageUrl: nullableString(row.image_url) ?? undefined,
    caption: nullableString(row.caption),
    userName: nullableString(row.user_name),
  };
}
