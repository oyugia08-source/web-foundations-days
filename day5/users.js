const usersUrl = "https://jsonplaceholder.typicode.com/users";
const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const status = document.querySelector("#status");
const usersList = document.querySelector("#users-list");
let users = [];

function createDetail(label, value) {
  const detail = document.createElement("p");
  detail.className = "user-detail";

  const detailLabel = document.createElement("span");
  detailLabel.className = "detail-label";
  detailLabel.textContent = label;

  const detailValue = document.createElement("span");
  detailValue.textContent = value;

  detail.append(detailLabel, detailValue);
  return detail;
}

function renderUsers(list) {
  usersList.replaceChildren();

  list.forEach((user) => {
    const item = document.createElement("li");
    item.className = "user-item";

    const name = document.createElement("h2");
    name.textContent = user.name;

    item.append(
      name,
      createDetail("Email", user.email),
      createDetail("City", user.address.city),
      createDetail("Company", user.company.name)
    );
    usersList.append(item);
  });
}

function filterUsers() {
  const query = filterInput.value.trim().toLowerCase();
  const matchingUsers = users.filter((user) =>
    user.name.toLowerCase().includes(query)
  );

  renderUsers(matchingUsers);

  if (matchingUsers.length === 0) {
    status.textContent = "No users match your filter.";
  } else {
    status.textContent = `Showing ${matchingUsers.length} of ${users.length} users.`;
  }
}

async function loadUsers() {
  loadButton.disabled = true;
  status.textContent = "Loading users...";

  try {
    const response = await fetch(usersUrl);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    users = await response.json();
    filterUsers();
  } catch (error) {
    status.textContent = "Unable to load users. Please try again.";
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);
filterInput.addEventListener("input", filterUsers);