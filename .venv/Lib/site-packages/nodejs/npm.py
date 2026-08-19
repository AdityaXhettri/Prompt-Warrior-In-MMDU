import os, sys, subprocess
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    call = subprocess.call
    run = subprocess.run
    Popen = subprocess.Popen

else:
    def call(args, **kwargs):
        return subprocess.call([
            os.path.join(os.path.dirname(__file__), "npm.cmd"),
            *args
        ], **kwargs)

    def run(args, **kwargs):
        return subprocess.run([
            os.path.join(os.path.dirname(__file__), "npm.cmd"),
            *args
        ], **kwargs)
    
    def Popen(args, **kwargs):
        return subprocess.Popen([
            os.path.join(os.path.dirname(__file__), "npm.cmd"),
            *args
        ], **kwargs)

def main() -> None:
    sys.exit(call(sys.argv[1:]))

if __name__ == '__main__':
    main()