-- Apply once to databases created before the live-job-sync upgrade.
ALTER TABLE Jobs
    ADD COLUMN source_provider VARCHAR(50) NULL AFTER date_crawled,
    ADD COLUMN last_seen_at DATETIME NULL AFTER source_provider;

UPDATE Jobs SET last_seen_at = date_crawled WHERE last_seen_at IS NULL;

CREATE TABLE IF NOT EXISTS Job_Sync_Runs (
    sync_run_id    INT           NOT NULL AUTO_INCREMENT,
    provider       VARCHAR(50)   NOT NULL,
    location       VARCHAR(255)  NOT NULL,
    query          VARCHAR(255),
    status         VARCHAR(20)   NOT NULL,
    fetched_count  INT           NOT NULL DEFAULT 0,
    upserted_count INT           NOT NULL DEFAULT 0,
    error_count    INT           NOT NULL DEFAULT 0,
    error_message  TEXT,
    started_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at    DATETIME,
    PRIMARY KEY (sync_run_id),
    INDEX idx_sync_runs_started (started_at)
) ENGINE=InnoDB;
