/*
This file is part of Ardoise - A Plume🪶 document generator

Copyright © Erwan Barbedor
Licensed under the MIT License — see LICENSE for details.
*/

if (exerciceSheetMode == "screen") {

	// screen mode: build the control bar, then mirror into the display
	// the exercises matching the current filters, one per selected level

	var screenControls = document.querySelector('.ardoise--exercice-sheet-screen--controls');
	var screenDisplay = document.querySelector('.ardoise--exercice-sheet-screen--display');
	var objSlot = screenControls.querySelector('.ardoise--select--obj');
	var levelSlot = screenControls.querySelector('.ardoise--select--level');
	var exSlot = screenControls.querySelector('.ardoise--select--ex');
	var toggleSlot = screenControls.querySelector('.ardoise--toggle--correction');

	// one row per exercise, read from the --infos data fields
	var exercises = [];
	var exerciceNodes = document.querySelectorAll('.ardoise--exercice-sheet--exercice');
	var e;
	for (e = 0; e < exerciceNodes.length; e++) {
		var infos = exerciceNodes[e].querySelector('.ardoise--exercice-sheet--exercice--infos');
		if (infos) {
			exercises.push({
				node: exerciceNodes[e],
				objective: parseInt(infos.getAttribute('data-objective'), 10),
				count: parseInt(infos.getAttribute('data-exercice-count'), 10),
				level: parseInt(infos.getAttribute('data-level'), 10),
				type: infos.getAttribute('data-type')
			});
		}
	}

	// unique ascending values
	function distinctSorted(values) {
		var seen = {};
		var out = [];
		var i;
		for (i = 0; i < values.length; i++) {
			if (seen[values[i]] === undefined) {
				seen[values[i]] = true;
				out.push(values[i]);
			}
		}
		out.sort(function (a, b) { return a - b; });
		return out;
	}

	var objectiveValues = [];
	var levelValues = [];
	for (e = 0; e < exercises.length; e++) {
		objectiveValues.push(exercises[e].objective);
		levelValues.push(exercises[e].level);
	}
	var objectives = distinctSorted(objectiveValues);
	var levels = distinctSorted(levelValues);

	// current filter state
	var currentObjective = null;
	var currentCount = null;
	var currentType = 'Instruction';
	var correctionOn = false;

	// -- custom select: value button + dropdown list ---------------------

	var openSelect = null;

	function buildSelect(slot) {
		var root = document.createElement('div');
		root.className = 'ardoise--select';
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'ardoise--select--value';
		var optionsBox = document.createElement('div');
		optionsBox.className = 'ardoise--select--options';
		root.appendChild(button);
		root.appendChild(optionsBox);
		slot.appendChild(root);

		var options = [];
		var value = null;
		var api = null;

		function htmlFor(v) {
			var i;
			for (i = 0; i < options.length; i++) {
				if (options[i].value === v) {
					return options[i].html;
				}
			}
			return '';
		}

		function setOpen(open) {
			if (open) {
				root.classList.add('ardoise--select--open');
			} else {
				root.classList.remove('ardoise--select--open');
			}
		}

		function close() {
			setOpen(false);
			if (openSelect === api) {
				openSelect = null;
			}
		}

		function open() {
			if (openSelect && openSelect !== api) {
				openSelect.close();
			}
			openSelect = api;
			setOpen(true);
		}

		function render() {
			button.innerHTML = htmlFor(value);
			while (optionsBox.firstChild) {
				optionsBox.removeChild(optionsBox.firstChild);
			}
			var i;
			for (i = 0; i < options.length; i++) {
				(function (option) {
					var el = document.createElement('div');
					el.className = 'ardoise--select--option';
					if (option.value === value) {
						el.className += ' ardoise--select--option--selected';
					}
					el.innerHTML = option.html;
					el.addEventListener('click', function () {
						value = option.value;
						render();
						close();
						// api.onChange is assigned by the caller after buildSelect
						if (api && api.onChange) {
							api.onChange();
						}
					});
					optionsBox.appendChild(el);
				})(options[i]);
			}
		}

		// keep the value when it still exists, else fall back to first
		function setOptions(newOptions) {
			options = newOptions;
			var found = false;
			var i;
			for (i = 0; i < options.length; i++) {
				if (options[i].value === value) {
					found = true;
					break;
				}
			}
			if (!found) {
				value = options.length ? options[0].value : null;
			}
			render();
		}

		button.addEventListener('click', function () {
			if (root.classList.contains('ardoise--select--open')) {
				close();
			} else {
				open();
			}
		});

		api = {
			root: root,
			setOptions: setOptions,
			setValue: function (v) {
				value = v;
				render();
			},
			getValue: function () {
				return value;
			},
			close: close,
			onChange: null
		};
		return api;
	}

	// a click outside any open select closes it
	document.addEventListener('click', function (ev) {
		if (openSelect && !openSelect.root.contains(ev.target)) {
			openSelect.close();
		}
	});

	// -- level selection: clickable stars ---------------------------------

	// only the smallest level is selected at start
	var levelButtons = [];
	var minLevel = levels.length ? levels[0] : null;
	var li;
	for (li = 0; li < levels.length; li++) {
		(function (level) {
			var el = document.createElement('div');
			el.className = 'ardoise--level';
			if (level !== minLevel) {
				el.className += ' ardoise--level-disable';
			}
			var s;
			for (s = 0; s < 3; s++) {
				var span = document.createElement('span');
				span.className = (s < level ? 'ardoise--level--full' : 'ardoise--level--empty');
				el.appendChild(span);
			}
			el.addEventListener('click', function () {
				el.classList.toggle('ardoise--level-disable');
				updateScreen();
			});
			levelSlot.appendChild(el);
			levelButtons.push({ level: level, el: el });
		})(levels[li]);
	}

	function selectedLevels() {
		var out = [];
		var k;
		for (k = 0; k < levelButtons.length; k++) {
			if (!levelButtons[k].el.classList.contains('ardoise--level-disable')) {
				out.push(levelButtons[k].level);
			}
		}
		out.sort(function (a, b) { return a - b; });
		return out;
	}

	// -- correction toggle ------------------------------------------------

	var toggleEl = document.createElement('div');
	toggleEl.className = 'ardoise--toggle';
	toggleEl.setAttribute('role', 'switch');
	toggleEl.setAttribute('aria-checked', 'false');
	var knob = document.createElement('span');
	knob.className = 'ardoise--toggle--knob';
	toggleEl.appendChild(knob);
	toggleSlot.appendChild(toggleEl);
	toggleSlot.appendChild(document.createTextNode('Correction'));

	toggleSlot.addEventListener('click', function () {
		correctionOn = !correctionOn;
		if (correctionOn) {
			toggleEl.classList.add('ardoise--toggle--on');
		} else {
			toggleEl.classList.remove('ardoise--toggle--on');
		}
		toggleEl.setAttribute('aria-checked', correctionOn ? 'true' : 'false');
		updateScreen();
	});

	function correctionType() {
		return correctionOn ? 'Correction' : 'Instruction';
	}

	// -- filtering ---------------------------------------------------------

	// exercises of the current objective at a given level, in count order
	function listFor(level, type) {
		var out = [];
		var j;
		for (j = 0; j < exercises.length; j++) {
			var x = exercises[j];
			if (x.objective === currentObjective && x.level === level && (type === null || x.type === type)) {
				out.push(x);
			}
		}
		out.sort(function (a, b) { return a.count - b.count; });
		return out;
	}

	// counts for the current objective and the smallest selected
	// level only; they do not depend on the type toggle
	function currentCounts() {
		var selLevels = selectedLevels();
		var counts = [];
		var n;
		if (selLevels.length) {
			var base = listFor(selLevels[0], null);
			for (n = 0; n < base.length; n++) {
				counts.push(base[n].count);
			}
		}
		return distinctSorted(counts);
	}

	function updateExOptions() {
		var counts = currentCounts();
		var options = [];
		var n;
		for (n = 0; n < counts.length; n++) {
			options.push({ value: counts[n], html: 'Ex ' + counts[n] });
		}
		exSelect.setOptions(options);
		currentCount = exSelect.getValue();
	}

	// recompute the display from the current filters
	function updateScreen() {
		currentType = correctionType();
		updateExOptions();

		while (screenDisplay.firstChild) {
			screenDisplay.removeChild(screenDisplay.firstChild);
		}

		var selLevels = selectedLevels();
		if (!selLevels.length || currentCount === null) {
			return;
		}

		// index of the current exercise in the smallest level's list
		var baseList = listFor(selLevels[0], currentType);
		var index = -1;
		var p;
		for (p = 0; p < baseList.length; p++) {
			if (baseList[p].count === currentCount) {
				index = p;
				break;
			}
		}
		if (index === -1) {
			return;
		}

		// same index (wrapped) in every selected level's list
		var q;
		for (q = 0; q < selLevels.length; q++) {
			var list = listFor(selLevels[q], currentType);
			if (!list.length) {
				continue;
			}
			screenDisplay.appendChild(list[index % list.length].node.cloneNode(true));
		}
	}

	// -- build the control bar ---------------------------------------------

	// objective select, default 1
	var objSelect = buildSelect(objSlot);
	var objOptions = [];
	var oi;
	for (oi = 0; oi < objectives.length; oi++) {
		objOptions.push({
			value: objectives[oi],
			html: 'Obj <span class="ardoise--objectif-count">' + objectives[oi] + '</span>'
		});
	}
	objSelect.setOptions(objOptions);
	if (objectives.indexOf(1) !== -1) {
		objSelect.setValue(1);
	}
	currentObjective = objSelect.getValue();
	objSelect.onChange = function () {
		currentObjective = objSelect.getValue();
		updateScreen();
	};

	// exercise select, rebuilt on every filter change
	var exSelect = buildSelect(exSlot);
	exSelect.onChange = function () {
		updateScreen();
	};

	// random exercise button, next to the exercise select
	var randomButton = document.createElement('button');
	randomButton.type = 'button';
	randomButton.className = 'ardoise--select--random';
	randomButton.textContent = '⟳';
	randomButton.setAttribute('title', 'Exercice au hasard');
	randomButton.addEventListener('click', function () {
		var counts = currentCounts();
		if (counts.length) {
			exSelect.setValue(counts[Math.floor(Math.random() * counts.length)]);
			updateScreen();
		}
	});
	exSlot.appendChild(randomButton);

	// initial state: first exercise of the smallest level
	updateScreen();
}
