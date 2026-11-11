@echo off
rem 霞客行 一键启动（数据库不需要，纯静态）
cd /d "%~dp0"
start "" http://localhost:8946
node server.js
