@echo off
setlocal enabledelayedexpansion

:: 切换到脚本所在目录
cd /d "%~dp0"

title Concept Art Prompt Generator Launcher

echo ==========================================
echo    正在启动 Concept Art Prompt Generator
echo ==========================================
echo.

:: 1. 检查 Node.js/npm 是否安装
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 严重错误: 未找到 'npm' 命令。
    echo.
    echo -----------------------------------------------------
    echo [排查指南]
    echo 1. 请确认您是否已安装 Node.js？
    echo    - 下载地址： https://nodejs.org/ (推荐 LTS 版本)
    echo.
    echo 2. 如果已安装，请尝试重启电脑以刷新环境变量。
    echo -----------------------------------------------------
    echo.
    pause
    exit /b 1
)

:: 显示当前 Node 版本
for /f "delims=" %%v in ('node -v') do echo [INFO] 当前 Node 版本: %%v

:: 2. 检查 node_modules 是否存在，不存在则安装
if not exist "node_modules" (
    echo.
    echo [INFO] 未检测到依赖包 (node_modules)，正在首次安装...
    echo [INFO] 这可能需要几分钟，取决于您的网络状况...
    echo.
    
    call npm install
    
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] 依赖安装失败。
        echo 请检查网络连接，或尝试手动运行 'npm install'。
        pause
        exit /b 1
    )
    
    echo [SUCCESS] 依赖安装成功！
    echo.
) else (
    echo [INFO] 依赖检查通过。
)

:: 3. 启动开发服务器
echo.
echo [INFO] 正在启动本地服务...
echo ------------------------------------------
call npm run dev

:: 如果服务意外退出，暂停显示错误信息
echo.
echo [INFO] 服务已停止。
pause

