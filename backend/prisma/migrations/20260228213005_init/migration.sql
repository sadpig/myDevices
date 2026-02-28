-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('iPhone', 'iPad', 'Mac', 'AppleTV', 'AppleWatch', 'VisionPro');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('pending', 'enrolled', 'unenrolled');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('in_use', 'in_stock', 'repairing', 'retired', 'lost');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'device_admin', 'readonly');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('queued', 'sent', 'acknowledged', 'error', 'not_now');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'readonly',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "udid" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "model" TEXT,
    "model_name" TEXT,
    "os_version" TEXT,
    "build_version" TEXT,
    "device_name" TEXT,
    "product_name" TEXT,
    "storage_capacity" BIGINT,
    "wifi_mac" TEXT,
    "bluetooth_mac" TEXT,
    "enrollment_status" "EnrollmentStatus" NOT NULL DEFAULT 'pending',
    "last_seen_at" TIMESTAMP(3),
    "mdm_enrolled" BOOLEAN NOT NULL DEFAULT false,
    "supervised" BOOLEAN NOT NULL DEFAULT false,
    "push_magic" TEXT,
    "push_token" TEXT,
    "unlock_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3),
    "purchase_price" DECIMAL(10,2),
    "warranty_end" TIMESTAMP(3),
    "assigned_to" TEXT,
    "department" TEXT,
    "location" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'in_stock',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdm_commands" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "command_type" TEXT NOT NULL,
    "payload" JSONB,
    "status" "CommandStatus" NOT NULL DEFAULT 'queued',
    "request_id" TEXT NOT NULL,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "result" JSONB,

    CONSTRAINT "mdm_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "payload_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_profiles" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "devices_udid_key" ON "devices"("udid");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serial_number_key" ON "devices"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "assets_device_id_key" ON "assets"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "mdm_commands_request_id_key" ON "mdm_commands"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_identifier_key" ON "profiles"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "device_profiles_device_id_profile_id_key" ON "device_profiles"("device_id", "profile_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mdm_commands" ADD CONSTRAINT "mdm_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_profiles" ADD CONSTRAINT "device_profiles_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_profiles" ADD CONSTRAINT "device_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
