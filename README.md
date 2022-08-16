# Script Launcher
This is an Obsydian plugin that allows you to easily run script written in any language directly from the app

## How to use it
### Adding a new script 
Go in the pligin settings and click the `+` icon
You will have to fill in some information about the script you want to add:
1. `Script name` → the name of the script you want to add (has no influnence on the script itself)
2. `Script path` → absolute path to the script you want to launch (it can be anything: binary, executable, python script,shell script, bash script ecc...)
3. `Show on bottom bar` → this is a checkbox, if selected the script will be shoen on the bottom bar and clicking it will launch it
4. `Icon` → is the icon discplayed on the bottom bar, if left empty the name will be shown instead

### Deleting a script 
Click the `Delete` button on the script's settings you want to delete 

### Launching a script 
Click the scipt icon on the bottom bar of the obsydian app.
If the script does not show up as an icon go in the settings and select `Show on bottom bar`

The output of the script will be shown as notices in the Obsydian app

## Examples 

### Google Drive backup 
This script for example syncs on demand files from all you vaults at the click of a button
```bash
 (cd $path_to_vaults && grive -s $vaults_folder)
```
![](https://github.com/AlessandroRuggiero/script-launcher/blob/master/docs/images/launching-scipt-example.gif)
## Advanced settings
The scripts informations are saved in the `data.json` file under the `.obsydian/plugins` folder
This is how it looks normally:
```json
[
    {
        "name": "Example",
        "path": "/home/user/Documents/obsi/s.sh",
        "showOnBottomBar": true,
        "icon": "☁",
    }
]
```
But you can manually add some options that are not shown in the user interface if needed:
1. Showing exit code → add this filed to the json
    ```json
    "showExitCode": true
    ```
    The exit code will be shown as a Obsydian notice:
    ![exit code notice](https://github.com/AlessandroRuggiero/script-launcher/blob/master/docs/images/exit-code-notice.png)
## TODO
- Pass paths and other informations as parameters to scripts