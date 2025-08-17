import { eq } from "drizzle-orm";
import * as cron from "node-cron";
import { db } from "@/lib/db";
import { NewHotspotProfile, vouchers } from "@/database/schema/mikrotik";

// Store untuk menyimpan cron jobs yang sedang berjalan
const activeCronJobs = new Map<string, cron.ScheduledTask>();

interface VoucherLoginBody {
  router_id: number;
  mikrotik_profile_id: string;
  name: string;
}

interface VoucherLogoutBody {
  router_id: number;
  mikrotik_profile_id: string;
  name: string;
}

export const generateOnLoginScript = (profile: NewHotspotProfile): string => {
    let onLoginScript = '';
    
    // Base logging for all logins
    onLoginScript += ':put ("login,' + profile.name + ',' + (profile.price || 0) + ',"); ';
    
    if (profile.cron_enabled) {
      onLoginScript += generateScheduleScript(profile);
    }
    
    if (profile.lock_to_mac) {
      onLoginScript += generateMacLockScript();
    }
    
    if (profile.lock_to_server) {
      onLoginScript += generateServerLockScript();
    }
    
    return onLoginScript;
  }

  // Generate schedule-based expiry script
  export const generateScheduleScript = (profile: NewHotspotProfile): string => {
    const mode = profile.expired_mode === 'remove' ? 'X' : 'N';
    const validity = profile.validity || '1d';
    
    return `
      :local mode "${mode}";
      {
        :local date [/system clock get date];
        :local year [:pick $date 7 11];
        :local month [:pick $date 0 3];
        :local comment [/ip hotspot user get [/ip hotspot user find where name="$user"] comment];
        :local ucode [:pick $comment 0 2];
        
        :if ($ucode = "vc" or $ucode = "up" or $comment = "") do={
          /sys sch add name="$user" disable=no start-date=$date interval="${validity}";
          :delay 2s;
          :local exp [/sys sch get [/sys sch find where name="$user"] next-run];
          :local getxp [len $exp];
          
          :if ($getxp = 15) do={
            :local d [:pick $exp 0 6];
            :local t [:pick $exp 7 16];
            :local s ("/");
            :local exp ("$d$s$year $t");
            /ip hotspot user set comment="$exp $mode" [find where name="$user"];
          };
          
          :if ($getxp = 8) do={
            /ip hotspot user set comment="$date $exp $mode" [find where name="$user"];
          };
          
          :if ($getxp > 15) do={
            /ip hotspot user set comment="$exp $mode" [find where name="$user"];
          };
          
          /sys sch remove [find where name="$user"];
        }
      }
    `;
  }

  // Generate MAC address locking script
  export const generateMacLockScript = () : string =>  {
    return `
      :local mac $"mac-address";
      /ip hotspot user set mac-address=$mac [find where name=$user];
    `;
  }

  // Generate server locking script
  export const generateServerLockScript = () : string => {
    return `
      :local mac $"mac-address";
      :local srv [/ip hotspot host get [find where mac-address="$mac"] server];
      /ip hotspot user set server=$srv [find where name=$user];
    `;
  }


  
  /**
   * Memulai cron job untuk monitoring voucher
   */
  export function startVoucherCron(voucher: any) {
    const jobKey = `voucher_${voucher.id}`;
    
    // Hentikan job yang mungkin sudah ada
    stopVoucherCron(jobKey);
  
    // Buat cron job baru yang berjalan setiap menit
    const job = cron.schedule('* * * * *', async () => {
      try {
        await checkVoucherExpiry(voucher.id);
      } catch (error) {
        console.error(`Error checking voucher ${voucher.id}:`, error);
      }
    }, {
      timezone: "Asia/Jakarta" // Sesuaikan dengan timezone Anda
    });
  
    activeCronJobs.set(jobKey, job);
    console.log(`Started cron job for voucher ${voucher.id}`);
  }
  
  /**
   * Menghentikan cron job untuk voucher
   */
  export function stopVoucherCron(jobKey: string) {
    const job = activeCronJobs.get(jobKey);
    if (job) {
      job.stop();
      job.destroy();
      activeCronJobs.delete(jobKey);
      console.log(`Stopped cron job: ${jobKey}`);
    }
  }
  
  /**
   * Cek apakah voucher sudah expired
   */
  export async function checkVoucherExpiry(voucherId: number) {
    try {
      const [voucher] = await db
        .select()
        .from(vouchers)
        .where(eq(vouchers.id, voucherId))
        .limit(1);
  
      if (!voucher || voucher.status !== 'active') {
        stopVoucherCron(`voucher_${voucherId}`);
        return;
      }
  
      const now = new Date();
      
      // Cek apakah voucher sudah expired
      if (voucher.end_at && new Date(voucher.end_at) <= now) {
        await db
          .update(vouchers)
          .set({
            voucher_status: 'expired',
            cron_enabled: false,
            updated_at: now
          })
          .where(eq(vouchers.id, voucherId));
  
        stopVoucherCron(`voucher_${voucherId}`);
        console.log(`Voucher ${voucherId} has expired and cron job stopped`);
      } else {
        // Update cron_last_run
        await db
          .update(vouchers)
          .set({
            cron_last_run: now,
            cron_next_run: new Date(now.getTime() + 60000) // Next run in 1 minute
          })
          .where(eq(vouchers.id, voucherId));
      }
    } catch (error) {
      console.error(`Error checking expiry for voucher ${voucherId}:`, error);
    }
  }
  
  /**
   * Menghitung waktu berakhir berdasarkan validity string
   * Format validity: "1d" (1 hari), "5h" (5 jam), "30m" (30 menit)
   */
  export function calculateEndTime(startTime: Date, validity: string): Date {
    const endTime = new Date(startTime);
    
    const match = validity.match(/^(\d+)([dhm])$/);
    if (!match) {
      // Default 1 hour if format is invalid
      endTime.setHours(endTime.getHours() + 1);
      return endTime;
    }
  
    const value = parseInt(match[1]);
    const unit = match[2];
  
    switch (unit) {
      case 'd':
        endTime.setDate(endTime.getDate() + value);
        break;
      case 'h':
        endTime.setHours(endTime.getHours() + value);
        break;
      case 'm':
        endTime.setMinutes(endTime.getMinutes() + value);
        break;
      default:
        endTime.setHours(endTime.getHours() + 1);
    }
  
    return endTime;
  }
  
  /**
   * Format durasi dari milliseconds ke format yang mudah dibaca
   */
  export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
  
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Fungsi untuk inisialisasi cron jobs dari voucher yang sudah aktif
   * Panggil fungsi ini saat aplikasi start
   */
  export async function initializeVoucherCrons() {
    try {
      const activeVouchers = await db
        .select()
        .from(vouchers)
        .where(eq(vouchers.status, 'active'));
  
      for (const voucher of activeVouchers) {
        if (voucher.cron_enabled) {
          startVoucherCron(voucher);
        }
      }
  
      console.log(`Initialized ${activeVouchers.length} voucher cron jobs`);
    } catch (error) {
      console.error("Error initializing voucher crons:", error);
    }
  }
  
  /**
   * Fungsi untuk cleanup semua cron jobs
   * Panggil fungsi ini saat aplikasi shutdown
   */
  export function cleanupVoucherCrons() {
    for (const [key, job] of activeCronJobs) {
      job.stop();
      job.destroy();
    }
    activeCronJobs.clear();
    console.log("All voucher cron jobs cleaned up");
  }