CREATE DATABASE IF NOT EXISTS visitor_tracker;
USE visitor_tracker;

CREATE TABLE IF NOT EXISTS visitors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45),
    country VARCHAR(100),
    state VARCHAR(100),
    city VARCHAR(100),
    isp VARCHAR(255),
    browser_name VARCHAR(100),
    operating_system VARCHAR(100),
    device_type VARCHAR(50),
    screen_resolution VARCHAR(50),
    visit_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
