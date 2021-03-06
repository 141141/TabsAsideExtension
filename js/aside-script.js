if (window.location === window.parent.location && !window.location.protocol.includes("-extension:"))	// For open/close call
{
	var iframe = document.querySelector("iframe.tabsAsideIframe");
	if (!iframe)
	{
		iframe = document.createElement('iframe');

		iframe.setAttribute("class", "tabsAsideIframe");

		iframe.style.position = "fixed";
		iframe.style.zIndex = "2147483647";

		iframe.style.height = "100%";
		iframe.style.width = "100%";

		iframe.style.top = "0px";
		iframe.style.right = "0px";
		iframe.style.left = "0px";
		iframe.style.bottom = "0px";

		iframe.style.border = "none";
		iframe.style.background = "transparent";
		iframe.style.opacity = 0;

		var bodyStyle = document.body.getAttribute("style");
		document.body.setAttribute("style", "overflow: hidden !important");

		iframe.onload = () => setTimeout(() => iframe.style.opacity = 1, 100);

		iframe.src = chrome.extension.getURL("TabsAside.html");
		document.body.appendChild(iframe);
	}
	else
	{
		iframe.contentWindow.postMessage({ target: "TabsAside", command: "TogglePane" }, "*");
		setTimeout(() =>
		{
			iframe.remove();
			document.body.setAttribute("style", bodyStyle);
		}, 250);
	}
}
else // For init call
	Initialize();

function Initialize()
{
	var pane = document.querySelector(".tabsAside.pane");
	if (!pane)
		return;

	if (window.location !== window.parent.location)
	{
		pane.setAttribute("embedded", "");
		window.addEventListener('message', event =>
		{
			if (event.data.target == "TabsAside")
			{
				pane.parentElement.style.opacity = 0;
				pane.removeAttribute("opened");
			}
		});
	}

	UpdateLocale();

	if (window.matchMedia("(prefers-color-scheme: dark)").matches)
	{
		pane.parentElement.setAttribute("darkmode", "");
		document.querySelector("#icon").href = "icons/dark/empty/16.png";
	}

	document.querySelector(".tabsAside .saveTabs").onclick = SetTabsAside;
	document.querySelector(".tabsAside header .btn.remove").addEventListener("click", () =>
		chrome.runtime.sendMessage({ command: "togglePane" })
	);
	document.querySelector(".tabsAside.closeArea").addEventListener("click", () =>
		chrome.runtime.sendMessage({ command: "togglePane" })
	);

	document.querySelector("nav > p > small").textContent = chrome.runtime.getManifest()["version"];

	// Tabs dismiss option
	var loadOnRestoreCheckbox = document.querySelector("#loadOnRestore");
	chrome.storage.sync.get(
		{ "loadOnRestore": true },
		values => loadOnRestoreCheckbox.checked = values?.loadOnRestore ?? true
	);
	chrome.storage.onChanged.addListener((changes, namespace) =>
	{
		if (namespace == 'sync')
			for (key in changes)
				if (key === 'loadOnRestore')
					loadOnRestoreCheckbox.checked = changes[key].newValue
	});
	loadOnRestoreCheckbox.addEventListener("click", () =>
		chrome.storage.sync.set(
			{
				"loadOnRestore": loadOnRestoreCheckbox.checked
			})
	);

	// Exntension browser icon action
	var swapIconAction = document.querySelector("#swapIconAction");
	chrome.storage.sync.get(
		{ "setAsideOnClick": false },
		values => swapIconAction.checked = values?.setAsideOnClick ?? false
	);
	chrome.storage.onChanged.addListener((changes, namespace) =>
	{
		if (namespace == 'sync')
			for (key in changes)
				if (key === 'setAsideOnClick')
					swapIconAction.checked = changes[key].newValue
	});
	swapIconAction.addEventListener("click", () =>
		chrome.storage.sync.set(
			{
				"setAsideOnClick": swapIconAction.checked
			})
	);

	// Deletion confirmation dialog
	var showDeleteDialog = document.querySelector("#showDeleteDialog");
	chrome.storage.sync.get(
		{ "showDeleteDialog": true },
		values => showDeleteDialog.checked = values.showDeleteDialog
	);
	chrome.storage.onChanged.addListener((changes, namespace) =>
	{
		if (namespace == 'sync')
			for (key in changes)
				if (key === 'showDeleteDialog')
					showDeleteDialog.checked = changes[key].newValue
	});
	showDeleteDialog.addEventListener("click", () =>
		chrome.storage.sync.set(
			{
				"showDeleteDialog": showDeleteDialog.checked
			})
	);

	// Collections view switch
	chrome.storage.sync.get(
		{ "listview": false },
		values =>
		{
			if (values?.listview)
				pane.setAttribute("listview", "");
		}
	);
	document.querySelectorAll(".listviewSwitch").forEach(i =>
		{
			i.onclick = (args) =>
			{
				if (args.currentTarget.classList[1] == "list")
				{
					pane.setAttribute("listview", "");
					chrome.storage.sync.set({ "listview": true });
				}
				else
				{
					pane.removeAttribute("listview");
					chrome.storage.sync.set({ "listview": false });
				}
			}
		});
	chrome.storage.onChanged.addListener((changes, namespace) =>
	{
		if (namespace == 'sync')
			for (key in changes)
				if (key === 'listview')
					if (changes[key].newValue)
						pane.setAttribute("listview", "");
					else
						pane.removeAttribute("listview");
	});

	document.querySelectorAll(".tabsAside.pane > header nav button").forEach(i =>
		i.onclick = () =>
		{
			if (i.hasAttribute("feedback-button"))
			{
				if (chrome.runtime.getManifest()["update_url"] && chrome.runtime.getManifest()["update_url"].includes("edge.microsoft.com"))
					window.open("https://microsoftedge.microsoft.com/addons/detail/tabs-aside/kmnblllmalkiapkfknnlpobmjjdnlhnd", "_blank")
				else
					window.open("https://chrome.google.com/webstore/detail/tabs-aside/mgmjbodjgijnebfgohlnjkegdpbdjgin", "_blank")
			}
			else
				window.open(i.value, "_blank");
		});

	chrome.runtime.sendMessage({ command: "loadData" }, (collections) =>
	{
		if (document.querySelector(".tabsAside.pane section div") == null)
			collections.forEach(i =>
				AddCollection(i));
	});

	setTimeout(() => pane.setAttribute("opened", ""), 100);
}

function UpdateLocale()
{
	document.querySelectorAll("*[loc]").forEach(i => i.textContent = chrome.i18n.getMessage(i.getAttribute("loc")));
	document.querySelectorAll("*[loc_alt]").forEach(i => i.title = chrome.i18n.getMessage(i.getAttribute("loc_alt")));

	var swapActionsLabel = document.querySelector("label[loc=swapIconAction]");
	chrome.runtime.sendMessage({ command: "getShortcuts" }, (shortcuts) =>
		swapActionsLabel.textContent = swapActionsLabel.textContent.replace("%TOGGLE_SHORTCUT%", shortcuts.filter(i => i.name == "toggle-pane")[0].shortcut)
	);
}

function AddCollection(collection)
{
	var list = document.querySelector(".tabsAside section");
	list.querySelector("h2").setAttribute("hidden", "");

	var rawTabs = "";

	for (var i = 0; i < collection.links.length; i++)
	{
		rawTabs +=
			"<div title='" + collection.titles[i] + "'" + ((collection.thumbnails && collection.thumbnails[i]) ? " style='background-image: url(" + collection.thumbnails[i] + ")'" : "") + " value='" + collection.links[i] + "'>" +
				//"<span class='openTab' value='" + collection.links[i] + "'></span>" +
				"<div>" +
					"<div" + ((collection.icons[i] == 0 || collection.icons[i] == null) ? "" : " style='background-image: url(\"" + collection.icons[i] + "\")'") + "></div>" +
					"<span>" + collection.titles[i] + "</span>" +
					"<button loc_alt='removeTab' class='btn remove' title='Remove tab from collection'></button>" +
				"</div>" +
			"</div>";
	}

	list.innerHTML +=
		"<div class='collectionSet'>" +
			"<div class='header'>" +
				"<input type='text' value='" + (collection.name ?? new Date(collection.timestamp).toDateString()) + "'/>" +
				"<a loc='restoreTabs' class='restoreCollection'>Restore tabs</a>" +
				"<div>" +
					"<button loc_alt='more' class='btn more' title='More...'></button>" +
					"<nav>" +
						"<button loc='restoreNoRemove' class='restoreCollection noDelete'>Restore without removing</button>" +
					"</nav>" +
				"</div>" +
				"<button loc_alt='removeCollection' class='btn remove' title='Remove collection'></button>" +
				"<small>" + collection.links.length + " " + chrome.i18n.getMessage("tabs") +"</small>" +
			"</div>" +

			"<div class='set' class='tabsList'>" + rawTabs + "</div>" +
		"</div>";

	UpdateLocale();

	list.querySelectorAll("input").forEach(i =>
		i.oninput = (event) => RenameCollection(i.parentElement.parentElement, event.target.value));

	list.querySelectorAll(".restoreCollection").forEach(i =>
		i.onclick = () => RestoreTabs(i.parentElement.parentElement));

	list.querySelectorAll(".restoreCollection.noDelete").forEach(i =>
		i.onclick = () => RestoreTabs(i.parentElement.parentElement.parentElement.parentElement, false));

	list.querySelectorAll(".set > div").forEach(i =>
		i.onclick = (args) =>
		{
			if (args.target.localName != "button")
				chrome.runtime.sendMessage(
					{
						command: "openTab",
						url: i.getAttribute("value")
					}
				);
		});

	document.querySelectorAll(".header .btn.remove").forEach(i =>
		i.onclick = () => RemoveTabs(i.parentElement.parentElement));

	document.querySelectorAll(".set .btn.remove").forEach(i =>
		i.onclick = (args) =>
			RemoveOneTab(i.parentElement.parentElement));
}

function SetTabsAside()
{
	chrome.runtime.sendMessage({ command: "saveTabs" });
}

function RenameCollection(collectionData, name)
{
	chrome.runtime.sendMessage(
		{
			command: "renameCollection",
			newName: name,
			collectionIndex: Array.prototype.slice.call(collectionData.parentElement.children).indexOf(collectionData) - 1
		});
}

function RestoreTabs(collectionData, removeCollection = true)
{
	chrome.runtime.sendMessage(
		{
			command: "restoreTabs",
			removeCollection: removeCollection,
			collectionIndex: Array.prototype.slice.call(collectionData.parentElement.children).indexOf(collectionData) - 1
		},
		() =>
		{
			if (removeCollection)
				RemoveCollectionElement(collectionData);
		}
	);
}

function RemoveTabs(collectionData)
{
	chrome.storage.sync.get({ "showDeleteDialog": true }, values =>
	{
		if (values.showDeleteDialog && !confirm(chrome.i18n.getMessage("removeCollectionConfirm")))
			return;

		chrome.runtime.sendMessage(
			{
				command: "deleteTabs",
				collectionIndex: Array.prototype.slice.call(collectionData.parentElement.children).indexOf(collectionData) - 1
			},
			() => RemoveCollectionElement(collectionData)
		);
	});
}

function RemoveOneTab(tabData)
{
	chrome.storage.sync.get({ "showDeleteDialog": true }, values =>
	{
		if (values.showDeleteDialog && !confirm(chrome.i18n.getMessage("removeTabConfirm")))
			return;

		chrome.runtime.sendMessage(
			{
				command: "removeTab",
				collectionIndex: Array.prototype.slice.call(tabData.parentElement.parentElement.parentElement.children).indexOf(tabData.parentElement.parentElement) - 1,
				tabIndex: Array.prototype.slice.call(tabData.parentElement.children).indexOf(tabData)
			},
			() =>
			{
				tabData.parentElement.previousElementSibling.querySelector("small").textContent = (tabData.parentElement.children.length - 1) + " " + chrome.i18n.getMessage("tabs");
				if (tabData.parentElement.children.length < 2)
				{
					RemoveElement(tabData.parentElement.parentElement);
					if (document.querySelector("tabsAside.pane > section").children.length < 2)
						setTimeout(() => document.querySelector(".tabsAside.pane > section > h2").removeAttribute("hidden"), 250);
				}
				else
					RemoveElement(tabData);
			});
	});
}

function RemoveElement(el)
{
	el.style.opacity = 0;
	setTimeout(() => el.remove(), 200);
}

function RemoveCollectionElement(el)
{
	if (el.parentElement.children.length < 3)
		setTimeout(() => document.querySelector(".tabsAside.pane > section > h2").removeAttribute("hidden"), 250);
	RemoveElement(el);
}