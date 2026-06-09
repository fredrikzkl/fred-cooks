local project_root = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h")
local recipes_dir = project_root .. "/recipes/"

vim.api.nvim_create_autocmd("BufWritePost", {
  group = vim.api.nvim_create_augroup("FredCooksFormat", { clear = true }),
  pattern = "*.md",
  callback = function(args)
    if not vim.startswith(args.file, recipes_dir) then return end
    vim.fn.jobstart(
      { "node", project_root .. "/format.js", args.file },
      {
        cwd = project_root,
        on_exit = function(_, code)
          if code == 0 then
            vim.schedule(function() vim.cmd("silent! checktime") end)
          end
        end,
      }
    )
  end,
})
