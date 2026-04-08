"""Custom Bazel rule to bundle TypeScript apps using Bun."""

def _bun_bundle_impl(ctx):
    out = ctx.actions.declare_file(ctx.attr.name + "/index.js")

    inputs = depset(
        direct = ctx.files.srcs,
        transitive = [dep[DefaultInfo].files for dep in ctx.attr.deps],
    )

    ctx.actions.run_shell(
        inputs = inputs,
        outputs = [out],
        command = """
            set -euo pipefail
            cd {workspace}
            bun build {entry} --target=bun --outfile={out} --minify
        """.format(
            workspace = ctx.label.workspace_root or ".",
            entry = ctx.file.entry_point.path,
            out = out.path,
        ),
        mnemonic = "BunBundle",
        progress_message = "Bundling %s with Bun" % ctx.label,
        use_default_shell_env = True,
    )

    return [DefaultInfo(
        files = depset([out]),
        runfiles = ctx.runfiles(files = [out]),
    )]

bun_bundle = rule(
    implementation = _bun_bundle_impl,
    attrs = {
        "entry_point": attr.label(
            allow_single_file = [".ts", ".js"],
            mandatory = True,
        ),
        "srcs": attr.label_list(
            allow_files = [".ts", ".js", ".json"],
        ),
        "deps": attr.label_list(),
    },
)
