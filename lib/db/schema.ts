import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "customer"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("customer"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  salePrice: integer("sale_price"),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  rating: real("rating").notNull().default(4.5),
  reviewCount: integer("review_count").notNull().default(0),
  shortDescription: text("short_description").notNull(),
  description: text("description").notNull(),
  inStock: integer("in_stock").notNull().default(0),
  colorFamily: text("color_family").notNull(),
  patternStyle: text("pattern_style").notNull(),
  lengthOptions: jsonb("length_options").$type<string[]>().notNull().default([]),
  specifications: jsonb("specifications").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  status: orderStatusEnum("status").notNull().default("confirmed"),
  items: jsonb("items").$type<OrderItemJson[]>().notNull(),
  shipping: jsonb("shipping").$type<ShippingJson>().notNull(),
  subtotal: integer("subtotal").notNull(),
  shippingFee: integer("shipping_fee").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  total: integer("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
  /** Courier / waybill number shown to customers when shipped */
  trackingNumber: text("tracking_number"),
  /** Internal ops notes — not shown on storefront */
  adminNotes: text("admin_notes"),
  couponCode: text("coupon_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  label: text("label").default("Home"),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewModerationEnum = pgEnum("review_moderation", [
  "pending",
  "approved",
  "rejected",
]);

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  verified: boolean("verified").default(false),
  /** Admin moderation: only approved reviews show on the storefront */
  moderationStatus: reviewModerationEnum("moderation_status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Append-only status changes for delivery timeline history */
export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  actor: text("actor").notNull().default("system"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wholesaleInquiries = pgTable("wholesale_inquiries", {
  id: serial("id").primaryKey(),
  company: text("company").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  fabricTypes: text("fabric_types").notNull(),
  estimatedQuantity: text("estimated_quantity").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export interface OrderItemJson {
  productId: number;
  name: string;
  slug: string;
  category: string;
  image: string;
  selectedLength: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sellerId?: string;
  sellerName?: string;
  commissionPercent?: number;
  commissionAmount?: number;
}

export interface ShippingJson {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode?: string;
  country?: string;
}