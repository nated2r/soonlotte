document.addEventListener("DOMContentLoaded", () => {
    const wheel = document.getElementById("wheel");
    const spinBtn = document.getElementById("spin-btn");
    const resultModal = document.getElementById("result-modal");
    const closeModalBtn = document.getElementById("close-modal");
    const resultImage = document.getElementById("result-image");
    const fallbackText = document.getElementById("fallback-text");
    const fallbackPrizeName = document.getElementById("fallback-prize-name");
    const saveBtn = document.getElementById("save-btn");
    const btnText = spinBtn.querySelector(".btn-text");

    // Check localStorage for previous draw
    const hasDrawn = localStorage.getItem('hasDrawn');
    const savedPrizeIndex = localStorage.getItem('savedPrizeIndex');
    
    if (hasDrawn === 'true' && savedPrizeIndex !== null) {
        btnText.innerText = "查看中獎結果";
    }

    // Define 6 slices alternating between the two prizes
    const prizes = [
        { id: 1, name: "蘇打餅", image: "prize1.jpg", bgColor: "#cc0000", textColor: "#ffffff" },
        { id: 2, name: "下午茶組", image: "prize2.jpg", bgColor: "#ffffff", textColor: "#cc0000" },
        { id: 1, name: "蘇打餅", image: "prize1.jpg", bgColor: "#cc0000", textColor: "#ffffff" },
        { id: 2, name: "下午茶組", image: "prize2.jpg", bgColor: "#ffffff", textColor: "#cc0000" },
        { id: 1, name: "蘇打餅", image: "prize1.jpg", bgColor: "#cc0000", textColor: "#ffffff" },
        { id: 2, name: "下午茶組", image: "prize2.jpg", bgColor: "#ffffff", textColor: "#cc0000" }
    ];

    const sliceCount = prizes.length;
    const sliceAngle = 360 / sliceCount;

    // Create Wheel Background using conic-gradient
    let gradientParts = [];
    prizes.forEach((prize, index) => {
        const startAngle = index * sliceAngle;
        const endAngle = (index + 1) * sliceAngle;
        gradientParts.push(`${prize.bgColor} ${startAngle}deg ${endAngle}deg`);
    });
    
    const wheelBg = document.createElement("div");
    wheelBg.className = "wheel-bg";
    wheelBg.style.background = `conic-gradient(${gradientParts.join(', ')})`;
    wheel.appendChild(wheelBg);

    // Create Text Elements
    prizes.forEach((prize, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "slice-wrapper";
        // Rotate so that the text is centered in the slice.
        const rotation = (index * sliceAngle) + (sliceAngle / 2);
        wrapper.style.transform = `rotate(${rotation}deg)`;

        const text = document.createElement("div");
        text.className = "slice-text";
        text.style.color = prize.textColor;
        text.innerText = prize.name;

        wrapper.appendChild(text);
        wheel.appendChild(wrapper);
    });

    let currentRotation = 0;
    let isSpinning = false;

    // Google Apps Script Web App URL
    const API_URL = "https://script.google.com/macros/s/AKfycbwPPS3XIaLFNizDlIf86Y9vJ2eHyIyY5gWnObCMWL30gx0WnmCYh5Hg5Fd3TGbFiDWH2A/exec";

    spinBtn.addEventListener("click", async () => {
        if (isSpinning) return;

        // If already drawn, just show the result again without spinning
        if (localStorage.getItem('hasDrawn') === 'true') {
            const index = parseInt(localStorage.getItem('savedPrizeIndex'));
            if (!isNaN(index) && index >= 0 && index < sliceCount) {
                showResult(prizes[index]);
            }
            return;
        }

        if (!API_URL) {
            alert("系統尚未綁定 Google 試算表，無法抽獎！");
            return;
        }

        isSpinning = true;
        spinBtn.disabled = true;

        // 1. 開始預備旋轉（讓使用者覺得已經在抽獎了，隱藏連線延遲）
        const durationPerSpin = 600; // 每圈 0.6 秒
        const spinAnim = wheel.animate([
            { transform: `rotate(${currentRotation}deg)` },
            { transform: `rotate(${currentRotation + 360}deg)` }
        ], {
            duration: durationPerSpin,
            iterations: Infinity,
            easing: 'linear'
        });

        let winningIndex = 0;
        let fetchError = false;

        try {
            // 2. 背景非同步呼叫 Google API
            const response = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ action: "spin" }),
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                }
            });
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // 判斷抽中什麼
            if (data.prize === "下午茶組") {
                winningIndex = 1;
            } else {
                winningIndex = 0;
            }

        } catch (error) {
            console.error("Fetch API error:", error);
            fetchError = true;
        }

        // 3. 抓取目前動畫跑到哪裡，然後停止無窮動畫
        const playTime = spinAnim.currentTime || 0;
        spinAnim.cancel();

        // 算出目前確切的角度，避免視覺跳動
        currentRotation = currentRotation + ((playTime % durationPerSpin) / durationPerSpin) * 360;
        
        // 暫時關閉 CSS transition，並把輪盤鎖定在當前角度
        wheel.style.transition = 'none';
        wheel.style.transform = `rotate(${currentRotation}deg)`;
        
        // 強制瀏覽器重新渲染一次 (reflow)
        wheel.offsetHeight; 

        if (fetchError) {
            alert("網路連線異常，請確認網路狀態後重試！");
            isSpinning = false;
            spinBtn.disabled = false;
            return;
        }
        
        // 4. 記錄抽獎狀態
        localStorage.setItem('hasDrawn', 'true');
        localStorage.setItem('savedPrizeIndex', winningIndex.toString());
        
        // 5. 設定最終減速停止的角度
        const spins = 4; // 額外轉 4 圈作為減速
        const centerAngle = (winningIndex * sliceAngle) + (sliceAngle / 2);
        const targetRotation = currentRotation + (spins * 360) + (360 - (currentRotation % 360)) + (360 - centerAngle);

        currentRotation = targetRotation;
        
        // 重啟 CSS transition 來做完美的減速動畫
        wheel.style.transition = 'transform 4s cubic-bezier(0.1, 0.8, 0.1, 1)';
        wheel.style.transform = `rotate(${currentRotation}deg)`;

        // 等待減速動畫完成後跳出視窗
        setTimeout(() => {
            isSpinning = false;
            spinBtn.disabled = false;
            btnText.innerText = "查看中獎結果";
            showResult(prizes[winningIndex]);
        }, 4000);
    });

    let currentPrizeUrl = '';

    function showResult(prize) {
        currentPrizeUrl = prize.image;
        resultImage.src = prize.image;
        
        // Add a query string to avoid caching issues when user replaces images
        const timestamp = new Date().getTime();
        resultImage.src = `${prize.image}?t=${timestamp}`;

        resultImage.onerror = () => {
            // If image fails to load, show fallback
            resultImage.style.display = 'none';
            fallbackText.classList.remove('hidden');
            fallbackPrizeName.innerText = prize.name;
        };
        resultImage.onload = () => {
            resultImage.style.display = 'block';
            fallbackText.classList.add('hidden');
        }
        
        resultModal.classList.remove('hidden');
    }

    closeModalBtn.addEventListener("click", () => {
        resultModal.classList.add('hidden');
    });

    saveBtn.addEventListener("click", async () => {
        if (!currentPrizeUrl) return;

        // Change button text to indicate loading
        const originalText = saveBtn.innerText;
        saveBtn.innerText = "處理中...";
        saveBtn.disabled = true;

        try {
            // Fetch the image as a blob
            const response = await fetch(currentPrizeUrl);
            const blob = await response.blob();
            const file = new File([blob], "恭喜中獎.jpg", { type: blob.type });

            // Try using the native Web Share API (supports native "Save Image" on iOS/Android)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: '恭喜中獎！'
                });
            } else {
                // Fallback for browsers that don't support file sharing
                const link = document.createElement("a");
                const blobUrl = URL.createObjectURL(blob);
                link.href = blobUrl;
                link.download = "恭喜中獎.jpg";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            }
        } catch (error) {
            console.error("儲存失敗:", error);
            // If fetch or share fails, fallback to simple link click
            const link = document.createElement("a");
            link.href = currentPrizeUrl;
            link.download = "恭喜中獎.jpg";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            alert("如果沒有自動下載，請「長按圖片」即可儲存到手機相簿喔！");
        } finally {
            saveBtn.innerText = originalText;
            saveBtn.disabled = false;
        }
    });
});
