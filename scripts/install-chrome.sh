#!/bin/bash

# Chrome 브라우저 설치 스크립트
echo "Chrome 브라우저 설치를 시작합니다..."

# macOS에서 Chrome 설치
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macOS 감지됨"
    
    # Homebrew가 설치되어 있는지 확인
    if ! command -v brew &> /dev/null; then
        echo "Homebrew가 설치되어 있지 않습니다. 설치를 진행합니다..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # Chrome 설치
    echo "Chrome을 설치합니다..."
    brew install --cask google-chrome
    
    # Chrome 경로 확인
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if [ -f "$CHROME_PATH" ]; then
        echo "Chrome이 설치되었습니다: $CHROME_PATH"
        echo "환경 변수에 추가하세요:"
        echo "export CHROME_PATH=\"$CHROME_PATH\""
    else
        echo "Chrome 설치에 실패했습니다."
        exit 1
    fi

# Linux에서 Chrome 설치
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Linux 감지됨"
    
    # Ubuntu/Debian
    if command -v apt-get &> /dev/null; then
        echo "Ubuntu/Debian 시스템에서 Chrome을 설치합니다..."
        
        # Google Chrome Save소 추가
        wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
        echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
        
        # 패키지 업데이트 및 Chrome 설치
        sudo apt-get update
        sudo apt-get install -y google-chrome-stable
        
        # Chrome 경로 확인
        CHROME_PATH="/usr/bin/google-chrome"
        if [ -f "$CHROME_PATH" ]; then
            echo "Chrome이 설치되었습니다: $CHROME_PATH"
            echo "환경 변수에 추가하세요:"
            echo "export CHROME_PATH=\"$CHROME_PATH\""
        else
            echo "Chrome 설치에 실패했습니다."
            exit 1
        fi
    
    # CentOS/RHEL
    elif command -v yum &> /dev/null; then
        echo "CentOS/RHEL 시스템에서 Chrome을 설치합니다..."
        
        # Google Chrome Save소 추가
        sudo tee /etc/yum.repos.d/google-chrome.repo << EOM
[google-chrome]
name=google-chrome
baseurl=http://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOM
        
        # Chrome 설치
        sudo yum install -y google-chrome-stable
        
        # Chrome 경로 확인
        CHROME_PATH="/usr/bin/google-chrome"
        if [ -f "$CHROME_PATH" ]; then
            echo "Chrome이 설치되었습니다: $CHROME_PATH"
            echo "환경 변수에 추가하세요:"
            echo "export CHROME_PATH=\"$CHROME_PATH\""
        else
            echo "Chrome 설치에 실패했습니다."
            exit 1
        fi
    else
        echo "지원되지 않는 Linux 배포판입니다."
        exit 1
    fi

# Windows에서 Chrome 설치
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "Windows 감지됨"
    echo "Windows에서는 Chrome을 수동으로 설치해주세요."
    echo "https://www.google.com/chrome/ 에서 다운로드하여 설치하세요."
    echo "설치 후 Chrome 경로를 환경 변수에 추가하세요."
    echo "일반적인 경로: C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

else
    echo "지원되지 않는 운영체제입니다: $OSTYPE"
    exit 1
fi

echo "설치가 완료되었습니다!"
echo "Puppeteer를 사용하기 전에 환경 변수를 설정하세요." 