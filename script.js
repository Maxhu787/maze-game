const questions = [
  {
    question: "1 + 1 是多少？🙂",
    options: ["1", "2", "3", "4"],
    correct: 1,
  },
  {
    question: "如果 f(n) = n * f(n-1) 且 f(1) = 1，那麼 f(3) 會回傳多少？",
    options: ["3", "6", "9", "12"],
    correct: 1,
  },
  {
    question: "這個迴圈會跑幾次？\nfor(int i = 0; i < 5; i++)",
    options: ["4", "5", "6", "∞"],
    correct: 1,
  },
  {
    question: "11 % 4 = x ， x 是多少？",
    options: ["1", "2", "3", "4"],
    correct: 2,
  },
  {
    question: "(5 > 2) ? 'a' : 'b' 的輸出是什麼？",
    options: ["a", "b", "5", "2"],
    correct: 0,
  },
  {
    question: "第一個商業化網頁瀏覽器是在哪一年推出？",
    options: ["1985~1987", "1988~1990", "1993~1994", "1999~2001"],
    correct: 2,
  },
  {
    question: "(0 || 1) || (1 & 1) 輸出？",
    options: ["true", "false", "1", "2"],
    correct: 0,
  },
  {
    question: "二進位 101 等於十進位多少？",
    options: ["2", "3", "4", "5"],
    correct: 3,
  },
];

// Standalone leaderboard loader for page refresh
function loadLeaderboardStandalone() {
  const leaderboard = JSON.parse(
    localStorage.getItem("mazeGameLeaderboard") || "[]"
  );
  leaderboard.sort((a, b) => a.time - b.time);
  const leaderboardList = document.getElementById("leaderboardList");
  if (!leaderboardList) return;
  if (leaderboard.length === 0) {
    leaderboardList.innerHTML =
      '<div style="text-align: center; color: #666; font-style: italic;">No scores yet!</div>';
    return;
  }
  leaderboardList.innerHTML = leaderboard
    .map((entry, index) => {
      const isTopScore = index === 0;
      return `
              <div class="leaderboard-entry ${isTopScore ? "top-score" : ""}">
                  <span class="rank">#${index + 1}</span>
                  <span class="name">${entry.name}</span>
                  <span class="score">${entry.score}/5</span>
                  <span class="time">${formatTimeStandalone(entry.time)}</span>
              </div>
            `;
    })
    .join("");
}
function formatTimeStandalone(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const ms = Math.floor((milliseconds % 1000) / 10)
    .toString()
    .padStart(2, "0");
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}.${ms}`;
}

class MazeGame {
  constructor() {
    this.canvas = document.getElementById("mazeCanvas");
    this.ctx = this.canvas.getContext("2d");

    // Calculate canvas size to fill available height
    const availableHeight = window.innerHeight - 60; // Subtract header height
    const availableWidth = window.innerWidth - 480; // Subtract left and right panels

    // Use the smaller dimension to keep maze square
    const size = Math.min(availableHeight - 40, availableWidth - 40); // Leave some padding

    this.canvas.width = size;
    this.canvas.height = size;

    // Calculate optimal cell size to fill canvas evenly
    this.cols = 29; // Odd number for proper maze generation
    this.rows = 29; // Odd number for proper maze generation
    this.cellSize = Math.floor(size / this.cols);

    // Adjust canvas size to fit perfectly
    this.canvas.width = this.cols * this.cellSize;
    this.canvas.height = this.rows * this.cellSize;

    // Color variables - easy to customize
    this.colors = {
      // mazeWalls: '#333',
      mazeWalls: "#fff",
      // player: '#4444ff',
      player: "#07a6f5",
      // questionPoints: '#ff4444',
      questionPoints: "#fff",
      // startPoint: '#00ff00',
      startPoint: "#00ff00",
      // endPoint: '#ff0000',
      endPoint: "#ff0000",
    };

    // Player positions - now using pixel coordinates for smooth movement
    this.player = {
      x: 1.5 * this.cellSize,
      y: 1.5 * this.cellSize,
    };
    this.playerRadius = this.cellSize / 3;
    this.moveSpeed = 7; // 4
    // ↑ Change this value to adjust speed. Example: 8 for fast, 2 for slow.

    this.questionPoints = [];
    this.answeredQuestions = new Set();
    this.score = 0;

    this.maze = [];
    this.currentQuestion = null;

    this.keysPressed = {};

    // Game timing
    this.startTime = null;
    this.gameTime = 0;
    this.gameTimer = null;

    this.initializeGame();
    this.setupEventListeners();
    this.loadLeaderboard();
  }

  initializeGame() {
    this.generateMaze();
    this.placeQuestionPoints();
    this.player = {
      x: 1.5 * this.cellSize,
      y: 1.5 * this.cellSize,
    };
    this.endPoint = {
      x: (this.cols - 1.5) * this.cellSize,
      y: (this.rows - 1.5) * this.cellSize,
    };
    this.answeredQuestions.clear();
    this.score = 0;
    this.gameWon = false;
    this.startTime = Date.now();
    this.gameTime = 0;

    // Start game timer
    if (this.gameTimer) clearInterval(this.gameTimer);
    this.gameTimer = setInterval(() => {
      this.gameTime = Date.now() - this.startTime;
      this.updateGameStats();
    }, 100);

    this.updateScore();
    this.updateGameStats();
    this.draw();
  }

  generateMaze() {
    // Initialize maze with walls
    this.maze = Array(this.rows)
      .fill()
      .map(() => Array(this.cols).fill(1));

    // Recursive backtracking maze generation
    const stack = [];
    const start = { x: 1, y: 1 };
    this.maze[start.y][start.x] = 0;
    stack.push(start);

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = this.getUnvisitedNeighbors(current);

      if (neighbors.length > 0) {
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];

        // Remove wall between current and next
        const wallX = current.x + (next.x - current.x) / 2;
        const wallY = current.y + (next.y - current.y) / 2;
        this.maze[wallY][wallX] = 0;
        this.maze[next.y][next.x] = 0;

        stack.push(next);
      } else {
        stack.pop();
      }
    }

    // Ensure start and end points are always accessible
    this.maze[1][1] = 0; // Start point
    this.maze[this.rows - 2][this.cols - 2] = 0; // End point

    // Create a guaranteed path to end if needed
    this.ensurePathToEnd();
  }

  ensurePathToEnd() {
    // Simple path creation from start area to end area
    let x = 1,
      y = 1;
    const endX = this.cols - 2;
    const endY = this.rows - 2;

    // Create horizontal path
    while (x < endX) {
      this.maze[y][x] = 0;
      x += 2;
      if (x < this.cols) this.maze[y][x] = 0;
      x++;
    }

    // Create vertical path
    while (y < endY) {
      this.maze[y][x - 1] = 0;
      y += 2;
      if (y < this.rows) this.maze[y][x - 1] = 0;
      y++;
    }

    // Ensure end point connection
    this.maze[endY][endX] = 0;
    if (endX > 1) this.maze[endY][endX - 1] = 0;
    if (endY > 1) this.maze[endY - 1][endX] = 0;
  }

  getUnvisitedNeighbors(cell) {
    const neighbors = [];
    const directions = [
      { x: 0, y: -2 }, // Up
      { x: 2, y: 0 }, // Right
      { x: 0, y: 2 }, // Down
      { x: -2, y: 0 }, // Left
    ];

    for (const dir of directions) {
      const newX = cell.x + dir.x;
      const newY = cell.y + dir.y;

      if (
        newX > 0 &&
        newX < this.cols - 1 &&
        newY > 0 &&
        newY < this.rows - 1 &&
        this.maze[newY][newX] === 1
      ) {
        neighbors.push({ x: newX, y: newY });
      }
    }

    return neighbors;
  }

  placeQuestionPoints() {
    this.questionPoints = [];
    const numQuestions = Math.min(5, questions.length);

    for (let i = 0; i < numQuestions; i++) {
      let x, y;
      do {
        x = Math.floor(Math.random() * (this.cols - 2)) + 1;
        y = Math.floor(Math.random() * (this.rows - 2)) + 1;
      } while (
        this.maze[y][x] === 1 ||
        (x === 1 && y === 1) || // Start point
        (x === this.cols - 2 && y === this.rows - 2) || // End point
        this.questionPoints.some((p) => p.x === x && p.y === y)
      );

      this.questionPoints.push({
        x: (x + 0.5) * this.cellSize,
        y: (y + 0.5) * this.cellSize,
        questionIndex: Math.floor(Math.random() * questions.length),
      });
    }
  }

  // Check if a circular player can move to a position without hitting walls
  canMoveTo(x, y) {
    const radius = this.playerRadius;

    // Check the four corners of the player's bounding box
    const corners = [
      { x: x - radius, y: y - radius },
      { x: x + radius, y: y - radius },
      { x: x - radius, y: y + radius },
      { x: x + radius, y: y + radius },
    ];

    for (const corner of corners) {
      const gridX = Math.floor(corner.x / this.cellSize);
      const gridY = Math.floor(corner.y / this.cellSize);

      if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
        return false;
      }

      if (this.maze[gridY][gridX] === 1) {
        return false;
      }
    }

    return true;
  }

  setupEventListeners() {
    // Track which keys are currently pressed
    this.keysPressed = {};

    document.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        this.keysPressed[e.key] = true;
      }
    });

    document.addEventListener("keyup", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        this.keysPressed[e.key] = false;
      }
    });

    // Game loop for smooth continuous movement
    const gameLoop = () => {
      if (
        document.getElementById("questionModal").style.display === "block" ||
        document.getElementById("nameModal").style.display === "block"
      ) {
        requestAnimationFrame(gameLoop);
        return; // Don't move while modal is showing
      }

      let moved = false;
      let newX = this.player.x;
      let newY = this.player.y;

      // Handle continuous movement
      if (this.keysPressed["ArrowUp"]) {
        newY -= this.moveSpeed;
        moved = true;
      }
      if (this.keysPressed["ArrowDown"]) {
        newY += this.moveSpeed;
        moved = true;
      }
      if (this.keysPressed["ArrowLeft"]) {
        newX -= this.moveSpeed;
        moved = true;
      }
      if (this.keysPressed["ArrowRight"]) {
        newX += this.moveSpeed;
        moved = true;
      }

      // Check collision and update position
      if (moved) {
        // Check X movement
        if (this.canMoveTo(newX, this.player.y)) {
          this.player.x = newX;
        } else {
          newX = this.player.x; // Reset X if collision
        }

        // Check Y movement
        if (this.canMoveTo(this.player.x, newY)) {
          this.player.y = newY;
        }

        this.checkQuestionPoint();
        this.checkWinCondition();
        this.draw();
      }

      requestAnimationFrame(gameLoop);
    };

    requestAnimationFrame(gameLoop);

    document.getElementById("restartBtn").addEventListener("click", () => {
      this.initializeGame();
    });

    document
      .getElementById("clearLeaderboardBtn")
      .addEventListener("click", () => {
        if (
          confirm(
            "Are you sure you want to clear the leaderboard? This cannot be undone."
          )
        ) {
          localStorage.removeItem("mazeGameLeaderboard");
          this.loadLeaderboard();
        }
      });

    // Question modal event listeners
    const options = document.querySelectorAll(".option");
    options.forEach((option) => {
      option.addEventListener("click", (e) => {
        this.handleAnswer(parseInt(e.target.dataset.index));
      });
    });

    document.getElementById("continueBtn").addEventListener("click", () => {
      this.closeQuestionModal();
    });

    // Name modal event listeners
    document.getElementById("submitNameBtn").addEventListener("click", () => {
      this.submitScore();
    });

    document.getElementById("nameInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.submitScore();
      }
    });

    // Test buttons event listeners
    document.getElementById("testQuestionBtn").addEventListener("click", () => {
      // Use first question point if available, else create a dummy
      let qp = this.questionPoints[0];
      if (!qp) {
        qp = { questionIndex: 0 };
        this.questionPoints[0] = qp;
      }
      this.showQuestion(qp, 0);
    });

    document.getElementById("testNameBtn").addEventListener("click", () => {
      this.showNameModal();
    });
  }

  checkWinCondition() {
    const distance = Math.sqrt(
      Math.pow(this.player.x - this.endPoint.x, 2) +
        Math.pow(this.player.y - this.endPoint.y, 2)
    );

    if (distance < this.cellSize / 2 && !this.gameWon) {
      this.gameWon = true;
      clearInterval(this.gameTimer);
      this.showNameModal();
    }
  }

  checkQuestionPoint() {
    this.questionPoints.forEach((point, index) => {
      if (this.answeredQuestions.has(index)) return;

      const distance = Math.sqrt(
        Math.pow(this.player.x - point.x, 2) +
          Math.pow(this.player.y - point.y, 2)
      );

      if (distance < this.cellSize / 2) {
        this.showQuestion(point, index);
      }
    });
  }

  showQuestion(questionPoint, pointIndex) {
    this.currentQuestionIndex = pointIndex;
    const question = questions[questionPoint.questionIndex];

    // Support line breaks in question text
    document.getElementById("questionText").innerHTML = question.question
      .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
      .replace(/\n/g, "<br>");

    const options = document.querySelectorAll(".option");
    options.forEach((option, index) => {
      option.textContent = question.options[index];
      option.className = "option";
      option.disabled = false;
    });

    document.getElementById("feedback").style.display = "none";
    document.getElementById("continueBtn").style.display = "none";
    document.getElementById("questionModal").style.display = "block";
  }

  handleAnswer(selectedIndex) {
    const questionPoint = this.questionPoints[this.currentQuestionIndex];
    const question = questions[questionPoint.questionIndex];
    const options = document.querySelectorAll(".option");
    const feedback = document.getElementById("feedback");

    // Disable all options
    options.forEach((option) => (option.disabled = true));

    // Show correct/incorrect styling
    options.forEach((option, index) => {
      if (index === question.correct) {
        option.classList.add("correct");
      } else if (index === selectedIndex && index !== question.correct) {
        option.classList.add("incorrect");
      }
    });

    // Show feedback
    if (selectedIndex === question.correct) {
      feedback.textContent = "Correct! Well done!";
      feedback.className = "correct";
      this.score++;
    } else {
      feedback.textContent = `Incorrect. The correct answer was: ${
        question.options[question.correct]
      }`;
      feedback.className = "incorrect";
    }

    feedback.style.display = "block";
    document.getElementById("continueBtn").style.display = "block";

    // Mark question as answered
    this.answeredQuestions.add(this.currentQuestionIndex);
    this.updateScore();
    this.updateGameStats();
  }

  closeQuestionModal() {
    document.getElementById("questionModal").style.display = "none";
    this.draw(); // Redraw to remove the question point
  }

  showNameModal() {
    // Subtract 1 second per correct answer for display
    const adjustedTime = Math.max(0, this.gameTime - this.score * 1000);
    document.getElementById("finalScore").textContent = this.score;
    document.getElementById("finalTime").textContent =
      this.formatTime(adjustedTime);
    document.getElementById("nameInput").value = "";
    document.getElementById("nameModal").style.display = "block";
    document.getElementById("nameInput").focus();
  }

  submitScore() {
    const name = document.getElementById("nameInput").value.trim();
    if (!name) {
      alert("請輸入名字");
      return;
    }

    // Subtract 1 second per correct answer for leaderboard
    const adjustedTime = Math.max(0, this.gameTime - this.score * 1000);

    const scoreData = {
      name: name,
      score: this.score,
      time: adjustedTime,
      date: new Date().toISOString(),
    };

    this.saveScore(scoreData);
    document.getElementById("nameModal").style.display = "none";
    this.loadLeaderboard();
  }

  saveScore(scoreData) {
    let leaderboard = JSON.parse(
      localStorage.getItem("mazeGameLeaderboard") || "[]"
    );
    leaderboard.push(scoreData);

    // Sort by time (ascending, i.e., fastest first)
    leaderboard.sort((a, b) => a.time - b.time);

    // Keep only top 10 scores
    leaderboard = leaderboard.slice(0, 10);

    localStorage.setItem("mazeGameLeaderboard", JSON.stringify(leaderboard));
  }

  loadLeaderboard() {
    const leaderboard = JSON.parse(
      localStorage.getItem("mazeGameLeaderboard") || "[]"
    );
    // Sort leaderboard by time (ascending)
    leaderboard.sort((a, b) => a.time - b.time);
    const leaderboardList = document.getElementById("leaderboardList");

    if (leaderboard.length === 0) {
      leaderboardList.innerHTML =
        '<div style="text-align: center; color: #666; font-style: italic;">No scores yet!</div>';
      return;
    }

    leaderboardList.innerHTML = leaderboard
      .map((entry, index) => {
        const isTopScore = index === 0;
        return `
                        <div class="leaderboard-entry ${
                          isTopScore ? "top-score" : ""
                        }">
                            <span class="rank">#${index + 1}</span>
                            <span class="name">${entry.name}</span>
                            <span class="score">${entry.score}/5</span>
                            <span class="time">${this.formatTime(
                              entry.time
                            )}</span>
                        </div>
                    `;
      })
      .join("");
  }

  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const ms = Math.floor((milliseconds % 1000) / 10)
      .toString()
      .padStart(2, "0");
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}.${ms}`;
  }

  updateScore() {
    // document.getElementById(
    //   "score"
    // ).textContent = `Questions Answered: ${this.score}`;
  }

  updateGameStats() {
    document.getElementById("gameTime").textContent = this.formatTime(
      this.gameTime
    );
    document.getElementById("questionsRemaining").textContent =
      this.questionPoints.length - this.answeredQuestions.size;
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw maze
    this.ctx.fillStyle = this.colors.mazeWalls;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.maze[y][x] === 1) {
          this.ctx.fillRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize
          );
        }
      }
    }

    // Draw start point (green square)
    this.ctx.fillStyle = this.colors.startPoint;
    this.ctx.fillRect(
      1 * this.cellSize + 2,
      1 * this.cellSize + 2,
      this.cellSize - 4,
      this.cellSize - 4
    );

    // Draw "START" text
    this.ctx.fillStyle = "#000";
    this.ctx.font = "10px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText("START", 1.5 * this.cellSize, 1.5 * this.cellSize + 3);

    // Draw end point (red square)
    const endGridX = this.cols - 2;
    const endGridY = this.rows - 2;
    this.ctx.fillStyle = this.colors.endPoint;
    this.ctx.fillRect(
      endGridX * this.cellSize + 2,
      endGridY * this.cellSize + 2,
      this.cellSize - 4,
      this.cellSize - 4
    );

    // Draw "END" text
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "10px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      "END",
      (endGridX + 0.5) * this.cellSize,
      (endGridY + 0.5) * this.cellSize + 3
    );

    // Draw question points (only unanswered ones)
    this.ctx.fillStyle = this.colors.questionPoints;
    this.questionPoints.forEach((point, index) => {
      if (!this.answeredQuestions.has(index)) {
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, this.cellSize / 3, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    });

    // Draw player (blue dot) using smooth pixel coordinates
    this.ctx.fillStyle = this.colors.player;
    this.ctx.beginPath();
    this.ctx.arc(
      this.player.x,
      this.player.y,
      this.playerRadius,
      0,
      2 * Math.PI
    );
    this.ctx.fill();
  }
}

// Start the game when page loads
window.addEventListener("load", () => {
  loadLeaderboardStandalone(); // Always load leaderboard on page refresh

  const game = new MazeGame();

  // Always load leaderboard on page refresh
  game.loadLeaderboard();

  // Test button: Show question modal with first question point (or dummy if none)
  document.getElementById("testQuestionBtn").addEventListener("click", () => {
    // Use first question point if available, else create a dummy
    let qp = game.questionPoints[0];
    if (!qp) {
      qp = { questionIndex: 0 };
      game.questionPoints[0] = qp;
    }
    game.showQuestion(qp, 0);
  });

  // Test button: Show name modal
  document.getElementById("testNameBtn").addEventListener("click", () => {
    game.showNameModal();
  });
});
