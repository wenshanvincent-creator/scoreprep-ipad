"""Release hosted runners occupied by this workstream's superseded commits."""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

branch = os.environ["CHECK_BRANCH"]
if branch != "feat/recognition-rendering":
    raise SystemExit("Cancellation is restricted to the recognition feature branch")
repo = os.environ["GITHUB_REPOSITORY"]
headers = {"Authorization": f"Bearer {os.environ['GH_TOKEN']}",
           "Accept": "application/vnd.github+json"}
url = f"https://api.github.com/repos/{repo}/actions/runs?" + urllib.parse.urlencode(dict(branch=branch, per_page=100))
with urllib.request.urlopen(urllib.request.Request(url, headers=headers)) as response:
    runs = json.load(response)["workflow_runs"]
for run in runs:
    if (run["head_branch"] != branch or run["head_sha"] == os.environ["CHECK_HEAD_SHA"]
            or run["id"] >= int(os.environ["GITHUB_RUN_ID"])
            or run["name"] not in ("Recognition and notation evidence", "iPad build")
            or run["status"] not in ("queued", "in_progress", "waiting", "pending", "requested")):
        continue
    request = urllib.request.Request(f"https://api.github.com/repos/{repo}/actions/runs/{run['id']}/cancel",
                                     headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request):
            print("Cancelled superseded recognition-branch check", run["id"])
    except urllib.error.HTTPError as error:
        if error.code != 409:  # A run may finish between listing and cancellation.
            raise
        print("Run already finished", run["id"])
