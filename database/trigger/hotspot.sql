-- 1. Fungsi untuk mendeteksi service category yang lebih akurat
CREATE OR REPLACE FUNCTION detect_service_category(
    p_called_station_id TEXT,
    p_nas_port_type TEXT,
    p_service_type TEXT,
    p_nas_port_id TEXT,
    p_framed_protocol TEXT,
    p_calling_station_id TEXT
) RETURNS VARCHAR(20) AS $$
BEGIN
    -- Deteksi berdasarkan MAC address di Calling-Station-Id (hotspot biasanya kirim MAC)
    IF p_calling_station_id ~ '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$' THEN
        RETURN 'hotspot';
    END IF;
    
    -- Deteksi berdasarkan Called-Station-Id untuk hotspot
    IF p_called_station_id ILIKE '%hotspot%' 
       OR p_called_station_id ILIKE '%wifi%' 
       OR p_called_station_id ILIKE '%wireless%'
       OR p_called_station_id ILIKE '%guest%'
       OR p_called_station_id ILIKE '%public%' THEN
        RETURN 'hotspot';
    END IF;
    
    -- Deteksi berdasarkan NAS-Port-Type
    IF p_nas_port_type ILIKE '%wireless%' 
       OR p_nas_port_type ILIKE '%802.11%'
       OR p_nas_port_type = 'Wireless-802.11'
       OR p_nas_port_type = 'Wireless-Other' THEN
        RETURN 'hotspot';
    END IF;
    
    -- Deteksi berdasarkan NAS-Port-Id (interface wireless MikroTik)
    IF p_nas_port_id ILIKE '%wlan%' 
       OR p_nas_port_id ILIKE '%wifi%' 
       OR p_nas_port_id ILIKE '%bridge%'
       OR p_nas_port_id ILIKE '%cap%'
       OR p_nas_port_id ILIKE '%wireless%' THEN
        RETURN 'hotspot';
    END IF;
    
    -- Deteksi berdasarkan Framed-Protocol
    IF p_framed_protocol = 'PPP' THEN
        RETURN 'pppoe';
    END IF;
    
    -- Deteksi berdasarkan Service-Type
    IF p_service_type = 'Login-User' THEN
        RETURN 'hotspot';
    ELSIF p_service_type = 'Framed-User' THEN
        -- Bisa jadi PPPoE atau Hotspot, perlu cek lebih lanjut
        IF p_framed_protocol = 'PPP' THEN
            RETURN 'pppoe';
        ELSE
            RETURN 'hotspot';
        END IF;
    END IF;
    
    -- Default ke pppoe jika tidak dapat mendeteksi
    RETURN 'pppoe';
END;
$$ LANGUAGE plpgsql;

-- 2. Fungsi trigger untuk auto-set service category
CREATE OR REPLACE FUNCTION auto_set_service_category()
RETURNS TRIGGER AS $$
BEGIN
    -- Set service_category berdasarkan deteksi otomatis
    NEW.service_category := detect_service_category(
        NEW.CalledStationId,
        NEW.NASPortType,
        NEW.ServiceType,
        NEW.NASPortId,
        NEW.FramedProtocol,
        NEW.CallingStationId
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Fungsi untuk sinkronisasi data ke hotspot_session
CREATE OR REPLACE FUNCTION sync_hotspot_session()
RETURNS TRIGGER AS $$
DECLARE
    v_hotspot_user_id INTEGER;
    v_nas_id INTEGER;
BEGIN
    -- Hanya proses jika service_category adalah hotspot
    IF NEW.service_category = 'hotspot' THEN
        
        -- Cari hotspot_user_id berdasarkan username
        SELECT id INTO v_hotspot_user_id 
        FROM hotspotUser 
        WHERE username = NEW.UserName;
        
        -- Cari nas_id berdasarkan NAS IP Address
        SELECT id INTO v_nas_id 
        FROM nas 
        WHERE nasname = NEW.NASIPAddress::text 
           OR ipaddr = NEW.NASIPAddress;
        
        -- Handle INSERT (session baru)
        IF TG_OP = 'INSERT' THEN
            INSERT INTO hotspot_session (
                username,
                acct_session_id,
                acct_unique_id,
                nas_ip_address,
                framed_ip_address,
                calling_station_id,
                start_time,
                update_time,
                stop_time,
                input_octets,
                output_octets,
                session_time,
                terminate_cause,
                active,
                service_category,
                radacct_id,
                hotspot_user_id,
                nas_id
            ) VALUES (
                NEW.UserName,
                NEW.AcctSessionId,
                NEW.AcctUniqueId,
                NEW.NASIPAddress,
                NEW.FramedIPAddress,
                NEW.CallingStationId,
                NEW.AcctStartTime,
                NEW.AcctUpdateTime,
                NEW.AcctStopTime,
                COALESCE(NEW.AcctInputOctets, 0),
                COALESCE(NEW.AcctOutputOctets, 0),
                COALESCE(NEW.AcctSessionTime, 0),
                NEW.AcctTerminateCause,
                CASE WHEN NEW.AcctStopTime IS NULL THEN 1 ELSE 0 END,
                'hotspot',
                NEW.RadAcctId,
                v_hotspot_user_id,
                v_nas_id
            );
            
        -- Handle UPDATE (session update)
        ELSIF TG_OP = 'UPDATE' THEN
            UPDATE hotspot_session SET
                update_time = NEW.AcctUpdateTime,
                stop_time = NEW.AcctStopTime,
                input_octets = COALESCE(NEW.AcctInputOctets, 0),
                output_octets = COALESCE(NEW.AcctOutputOctets, 0),
                session_time = COALESCE(NEW.AcctSessionTime, 0),
                terminate_cause = NEW.AcctTerminateCause,
                active = CASE WHEN NEW.AcctStopTime IS NULL THEN 1 ELSE 0 END
            WHERE acct_unique_id = NEW.AcctUniqueId;
            
            -- Jika tidak ada record yang terupdate, insert baru
            IF NOT FOUND THEN
                INSERT INTO hotspot_session (
                    username,
                    acct_session_id,
                    acct_unique_id,
                    nas_ip_address,
                    framed_ip_address,
                    calling_station_id,
                    start_time,
                    update_time,
                    stop_time,
                    input_octets,
                    output_octets,
                    session_time,
                    terminate_cause,
                    active,
                    service_category,
                    radacct_id,
                    hotspot_user_id,
                    nas_id
                ) VALUES (
                    NEW.UserName,
                    NEW.AcctSessionId,
                    NEW.AcctUniqueId,
                    NEW.NASIPAddress,
                    NEW.FramedIPAddress,
                    NEW.CallingStationId,
                    NEW.AcctStartTime,
                    NEW.AcctUpdateTime,
                    NEW.AcctStopTime,
                    COALESCE(NEW.AcctInputOctets, 0),
                    COALESCE(NEW.AcctOutputOctets, 0),
                    COALESCE(NEW.AcctSessionTime, 0),
                    NEW.AcctTerminateCause,
                    CASE WHEN NEW.AcctStopTime IS NULL THEN 1 ELSE 0 END,
                    'hotspot',
                    NEW.RadAcctId,
                    v_hotspot_user_id,
                    v_nas_id
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Fungsi untuk update customer status
CREATE OR REPLACE FUNCTION update_customer_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Jika sesi baru dimulai (AcctStopTime masih NULL)
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.AcctStopTime IS NULL) THEN
        UPDATE customers 
        SET status_customer = 'aktif', 
            updated_at = now() 
        WHERE username = NEW.UserName;
        
    -- Jika sesi berakhir (AcctStopTime berubah dari NULL ke isi)
    ELSIF TG_OP = 'UPDATE' AND OLD.AcctStopTime IS NULL AND NEW.AcctStopTime IS NOT NULL THEN
        UPDATE customers 
        SET status_customer = 'terminate', 
            updated_at = now() 
        WHERE username = NEW.UserName;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Drop trigger lama jika ada
DROP TRIGGER IF EXISTS radacct_service_category_trigger ON radacct;
DROP TRIGGER IF EXISTS trg_customer_status_on_insert ON radacct;
DROP TRIGGER IF EXISTS trg_customer_status_on_update ON radacct;
DROP TRIGGER IF EXISTS trg_hotspot_session_sync_insert ON radacct;
DROP TRIGGER IF EXISTS trg_hotspot_session_sync_update ON radacct;

-- 6. Buat trigger baru
-- Trigger untuk auto-set service category (BEFORE INSERT/UPDATE)
CREATE TRIGGER radacct_service_category_trigger
    BEFORE INSERT OR UPDATE ON radacct
    FOR EACH ROW 
    EXECUTE FUNCTION auto_set_service_category();

-- Trigger untuk sinkronisasi hotspot session (AFTER INSERT)
CREATE TRIGGER trg_hotspot_session_sync_insert
    AFTER INSERT ON radacct
    FOR EACH ROW 
    EXECUTE FUNCTION sync_hotspot_session();

-- Trigger untuk sinkronisasi hotspot session (AFTER UPDATE)
CREATE TRIGGER trg_hotspot_session_sync_update
    AFTER UPDATE ON radacct
    FOR EACH ROW 
    EXECUTE FUNCTION sync_hotspot_session();

-- Trigger untuk update customer status (AFTER INSERT)
CREATE TRIGGER trg_customer_status_on_insert
    AFTER INSERT ON radacct
    FOR EACH ROW 
    EXECUTE FUNCTION update_customer_status();

-- Trigger untuk update customer status (AFTER UPDATE)
CREATE TRIGGER trg_customer_status_on_update
    AFTER UPDATE OF AcctStopTime ON radacct
    FOR EACH ROW 
    EXECUTE FUNCTION update_customer_status();

-- 7. Update data yang sudah ada berdasarkan deteksi
UPDATE radacct 
SET service_category = detect_service_category(
    CalledStationId,
    NASPortType,
    ServiceType,
    NASPortId,
    FramedProtocol,
    CallingStationId
);

-- 8. Sinkronisasi data hotspot yang sudah ada
INSERT INTO hotspot_session (
    username,
    acct_session_id,
    acct_unique_id,
    nas_ip_address,
    framed_ip_address,
    calling_station_id,
    start_time,
    update_time,
    stop_time,
    input_octets,
    output_octets,
    session_time,
    terminate_cause,
    active,
    service_category,
    radacct_id,
    hotspot_user_id,
    nas_id
)
SELECT 
    r.UserName,
    r.AcctSessionId,
    r.AcctUniqueId,
    r.NASIPAddress,
    r.FramedIPAddress,
    r.CallingStationId,
    r.AcctStartTime,
    r.AcctUpdateTime,
    r.AcctStopTime,
    COALESCE(r.AcctInputOctets, 0),
    COALESCE(r.AcctOutputOctets, 0),
    COALESCE(r.AcctSessionTime, 0),
    r.AcctTerminateCause,
    CASE WHEN r.AcctStopTime IS NULL THEN 1 ELSE 0 END,
    'hotspot',
    r.RadAcctId,
    hu.id,
    n.id
FROM radacct r
LEFT JOIN hotspotUser hu ON hu.username = r.UserName
LEFT JOIN nas n ON (n.nasname = r.NASIPAddress::text OR n.ipaddr = r.NASIPAddress)
WHERE r.service_category = 'hotspot'
  AND NOT EXISTS (
      SELECT 1 FROM hotspot_session hs 
      WHERE hs.acct_unique_id = r.AcctUniqueId
  );

-- 9. Tambahkan constraint untuk memastikan integritas data
ALTER TABLE hotspot_session 
ADD CONSTRAINT chk_service_category 
CHECK (service_category = 'hotspot');

-- 10. Tambahkan index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_radacct_service_category_username 
ON radacct(service_category, UserName);

CREATE INDEX IF NOT EXISTS idx_radacct_nas_ip_service_category 
ON radacct(NASIPAddress, service_category);

CREATE INDEX IF NOT EXISTS idx_hotspot_session_radacct_id 
ON hotspot_session(radacct_id);

-- 11. View untuk monitoring integrasi
CREATE OR REPLACE VIEW v_hotspot_integration_status AS
SELECT 
    r.service_category,
    COUNT(*) as total_sessions,
    COUNT(hs.id) as synced_sessions,
    COUNT(*) - COUNT(hs.id) as missing_sessions,
    COUNT(CASE WHEN r.AcctStopTime IS NULL THEN 1 END) as active_sessions
FROM radacct r
LEFT JOIN hotspot_session hs ON hs.acct_unique_id = r.AcctUniqueId
GROUP BY r.service_category;

-- 12. Fungsi untuk manual sync jika diperlukan
CREATE OR REPLACE FUNCTION manual_sync_hotspot_session()
RETURNS TEXT AS $$
DECLARE
    synced_count INTEGER := 0;
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT * FROM radacct 
        WHERE service_category = 'hotspot' 
          AND NOT EXISTS (
              SELECT 1 FROM hotspot_session hs 
              WHERE hs.acct_unique_id = radacct.AcctUniqueId
          )
    LOOP
        -- Panggil fungsi sync
        PERFORM sync_hotspot_session();
        synced_count := synced_count + 1;
    END LOOP;
    
    RETURN 'Berhasil sinkronisasi ' || synced_count || ' session hotspot';
END;
$$ LANGUAGE plpgsql;