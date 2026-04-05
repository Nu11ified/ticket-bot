"""Custom Bazel rule to build Next.js apps."""

def _next_build_impl(ctx):
    out_dir = ctx.actions.declare_directory(ctx.attr.name + "_next_out")

    inputs = depset(
        direct = ctx.files.srcs,
        transitive = [dep[DefaultInfo].files for dep in ctx.attr.deps],
    )

    ctx.actions.run_shell(
        inputs = inputs,
        outputs = [out_dir],
        command = """
            set -euo pipefail
            cd {package_dir}
            NODE_ENV=production npx next build
            cp -r .next/standalone/* {out}/ 2>/dev/null || true
            cp -r .next/static {out}/.next/static 2>/dev/null || true
            cp -r public {out}/public 2>/dev/null || true
        """.format(
            package_dir = ctx.label.package,
            out = out_dir.path,
        ),
        mnemonic = "NextBuild",
        progress_message = "Building Next.js app %s" % ctx.label,
        use_default_shell_env = True,
    )

    return [DefaultInfo(
        files = depset([out_dir]),
        runfiles = ctx.runfiles(files = [out_dir]),
    )]

next_build = rule(
    implementation = _next_build_impl,
    attrs = {
        "srcs": attr.label_list(
            allow_files = True,
        ),
        "deps": attr.label_list(),
    },
)
