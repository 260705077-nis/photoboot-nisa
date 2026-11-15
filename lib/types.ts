export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

export type User = AuthUser & {
  createdAt: string;
  updatedAt: string;
};

export type Frame = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string;
  slotCount: 3 | 4;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Filter = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  cssFilter: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PhotoSession = {
  id: number;
  sessionCode: string;
  userId: number | null;
  frameId: number | null;
  filterId: number | null;
  photoCount: 3 | 4;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
  userName?: string | null;
  frameName?: string | null;
  filterName?: string | null;
};

export type Photo = {
  id: number;
  sessionId: number;
  position: number;
  imageUrl: string;
  createdAt: string;
  sessionCode?: string;
};

export type PhotoStrip = {
  id: number;
  sessionId: number;
  frameId: number | null;
  filterId: number | null;
  imageUrl: string;
  caption: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  sessionCode?: string;
  userName?: string | null;
  frameName?: string | null;
  filterName?: string | null;
};

export type Download = {
  id: number;
  photoStripId: number;
  userId: number | null;
  createdAt: string;
  imageUrl?: string;
  caption?: string | null;
  userName?: string | null;
};

export type ListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListResponse<T> = {
  data: T[];
  meta: ListMeta;
};
