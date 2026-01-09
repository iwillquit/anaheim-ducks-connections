/* Ducks Connections - static, no-build game */
(function(){
  const puzzles = window.DUCKS_CONNECTIONS_PUZZLES || [];
  const MAX_MISTAKES = 4;

  const elBoard = document.getElementById('board');
  const elFound = document.getElementById('foundGroups');
  const elMistakes = document.getElementById('mistakes');
  const elMsg = document.getElementById('message');
  const elPuzzleLabel = document.getElementById('puzzleLabel');

  const btnSubmit = document.getElementById('btnSubmit');
  const btnShuffle = document.getElementById('btnShuffle');
  const btnDeselect = document.getElementById('btnDeselect');
  const btnNew = document.getElementById('btnNew');
  const btnPlayAgain = document.getElementById('btnPlayAgain');
  const btnHelp = document.getElementById('btnHelp');

  const elReveal = document.getElementById('reveal');
  const elSolution = document.getElementById('solution');
  const helpDialog = document.getElementById('helpDialog');

  const DIFF_CLASS = ['easy','medium','hard','expert'];

  let state = null;

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function pickPuzzle(){
    if(!puzzles.length) throw new Error('No puzzles configured.');
    const p = puzzles[Math.floor(Math.random()*puzzles.length)];
    return JSON.parse(JSON.stringify(p));
  }

  function buildLookup(puzzle){
    const groupByItem = new Map();
    puzzle.groups.forEach((g,gi)=>{
      g.items.forEach(it=> groupByItem.set(it, gi));
    });
    return groupByItem;
  }

  function flattenItems(puzzle){
    const items = [];
    puzzle.groups.forEach(g => items.push(...g.items));
    return items;
  }

  function setMessage(text){
    elMsg.textContent = text || '';
  }

  function setMistakes(){
    elMistakes.textContent = `Mistakes: ${state.mistakes} / ${MAX_MISTAKES}`;
  }

  function renderBoard(){
    elBoard.innerHTML = '';
    // Order: found groups at top (their items), then remaining items in current tileOrder
    const ordered = [];
    state.foundOrder.forEach(gi=>{
      ordered.push(...state.puzzle.groups[gi].items);
    });
    const remaining = state.tileOrder.filter(it => !state.locked.has(it));
    ordered.push(...remaining);

    ordered.forEach(item=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile';
      btn.setAttribute('role', 'gridcell');
      btn.textContent = item;

      const isLocked = state.locked.has(item);
      if(isLocked){
        btn.classList.add('locked');
        const gi = state.groupByItem.get(item);
        const dc = DIFF_CLASS[state.puzzle.groups[gi].difficulty] || 'expert';
        btn.classList.add('tile-' + dc);
        btn.setAttribute('aria-disabled', 'true');
      }else{
        btn.addEventListener('click', ()=>toggleSelect(item));
      }

      if(state.selected.has(item)) btn.classList.add('selected');

      elBoard.appendChild(btn);
    });
  }

  function renderFoundGroups(){
    elFound.innerHTML = '';
    state.foundOrder.forEach(gi=>{
      const g = state.puzzle.groups[gi];
      const dc = DIFF_CLASS[g.difficulty] || 'expert';

      const card = document.createElement('div');
      card.className = `group-card group-${dc}`;

      const title = document.createElement('div');
      title.className = 'group-title';
      title.textContent = g.name;

      const items = document.createElement('div');
      items.className = 'group-items';
      g.items.forEach(it=>{
        const chip = document.createElement('span');
        chip.className = 'group-chip';
        chip.textContent = it;
        items.appendChild(chip);
      });

      card.appendChild(title);
      card.appendChild(items);
      elFound.appendChild(card);
    });
  }

  function renderSolution(){
    elSolution.innerHTML = '';
    state.puzzle.groups
      .slice()
      .sort((a,b)=>a.difficulty-b.difficulty)
      .forEach(g=>{
        const dc = DIFF_CLASS[g.difficulty] || 'expert';
        const card = document.createElement('div');
        card.className = `group-card group-${dc}`;

        const title = document.createElement('div');
        title.className = 'group-title';
        title.textContent = g.name;

        const items = document.createElement('div');
        items.className = 'group-items';
        g.items.forEach(it=>{
          const chip = document.createElement('span');
          chip.className = 'group-chip';
          chip.textContent = it;
          items.appendChild(chip);
        });

        card.appendChild(title);
        card.appendChild(items);
        elSolution.appendChild(card);
      });
  }

  function toggleSelect(item){
    if(state.locked.has(item)) return;
    if(state.selected.has(item)){
      state.selected.delete(item);
    }else{
      if(state.selected.size >= 4){
        setMessage('You can only select 4 tiles.');
        return;
      }
      state.selected.add(item);
    }
    updateSubmit();
    renderBoard();
  }

  function updateSubmit(){
    const n = state.selected.size;
    btnSubmit.disabled = (n !== 4) || state.over;
    btnSubmit.textContent = `Submit (${n}/4)`;
  }

  function countBestMatch(selectedArr){
    // Return best overlap with any remaining (unsolved) group
    let best = 0;
    let bestGroup = -1;
    state.puzzle.groups.forEach((g,gi)=>{
      if(state.solved.has(gi)) return;
      const s = new Set(g.items);
      let overlap = 0;
      for(const it of selectedArr) if(s.has(it)) overlap++;
      if(overlap > best){ best = overlap; bestGroup = gi; }
    });
    return {best, bestGroup};
  }

  function submit(){
    if(state.over) return;
    if(state.selected.size !== 4) return;

    const pick = Array.from(state.selected);
    const groupId = state.groupByItem.get(pick[0]);
    const isSameGroup = pick.every(it => state.groupByItem.get(it) === groupId) && !state.solved.has(groupId);

    if(isSameGroup){
      state.solved.add(groupId);
      state.foundOrder.push(groupId);
      pick.forEach(it => state.locked.add(it));
      state.selected.clear();

      const g = state.puzzle.groups[groupId];
      setMessage(`Solved: ${g.name}`);
      renderFoundGroups();
      renderBoard();

      if(state.solved.size === 4){
        endGame(true);
      }
    }else{
      const {best} = countBestMatch(pick);
      state.mistakes += 1;
      setMistakes();
      setMessage(`Not a group. Closest: ${best}/4 from the same group.`);
      if(state.mistakes >= MAX_MISTAKES){
        endGame(false);
      }
    }

    updateSubmit();
  }

  function endGame(won){
    state.over = true;
    updateSubmit();
    btnShuffle.disabled = true;
    btnDeselect.disabled = true;
    btnNew.disabled = false;

    renderSolution();
    elReveal.classList.remove('hidden');

    setMessage(won ? 'You won. Nice work.' : 'Out of mistakes. Better luck next time.');
  }

  function deselectAll(){
    state.selected.clear();
    updateSubmit();
    renderBoard();
  }

  function doShuffle(){
    // Only shuffle remaining unsolved tiles to keep solved groups at top
    const remaining = state.tileOrder.filter(it => !state.locked.has(it));
    const shuffled = shuffle(remaining);

    const newOrder = [];
    // keep original locked tiles in place by rebuilding full order:
    // store locked set separately; tileOrder is only for remaining
    newOrder.push(...shuffled);
    state.tileOrder = newOrder;
    renderBoard();
  }

  function newGame(){
    const puzzle = pickPuzzle();
    const items = flattenItems(puzzle);
    const tileOrder = shuffle(items);

    state = {
      puzzle,
      tileOrder,
      groupByItem: buildLookup(puzzle),
      selected: new Set(),
      locked: new Set(),
      solved: new Set(),
      foundOrder: [],
      mistakes: 0,
      over: false,
    };

    elPuzzleLabel.textContent = `${puzzle.title} (randomized)`;
    setMistakes();
    setMessage('Select 4 tiles to start.');
    elReveal.classList.add('hidden');
    elSolution.innerHTML = '';
    btnShuffle.disabled = false;
    btnDeselect.disabled = false;

    renderFoundGroups();
    renderBoard();
    updateSubmit();
  }

  // Wire up buttons
  btnSubmit.addEventListener('click', submit);
  btnShuffle.addEventListener('click', doShuffle);
  btnDeselect.addEventListener('click', deselectAll);
  btnNew.addEventListener('click', newGame);
  btnPlayAgain.addEventListener('click', newGame);
  btnHelp.addEventListener('click', ()=>{
    if(typeof helpDialog.showModal === 'function') helpDialog.showModal();
    else alert('Select 4 tiles, Submit. Find all 4 groups before 4 mistakes.');
  });

  // Start
  newGame();
})();