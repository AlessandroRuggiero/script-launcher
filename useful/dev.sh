#!/bin/sh

#remember to call this as ./useful/dev.sh to enusre the correct path to source file is set

echo target plugin directory:
read target_path

while read line
do
    echo "updating files..."
    npm run build
    for file in main.js styles.css manifest.json
    do
        cp $file $target_path/$file
    done
done