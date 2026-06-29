local NXFS = require "nixio.fs"
local SYS = require "luci.sys"
local HTTP = require "luci.http"
local fs = require "luci.openclash"
<<<<<<< HEAD
local file_path = ""

for i = 2, #(arg) do
	file_path = file_path .. "/" .. luci.http.urlencode(arg[i])
end

if not fs.isfile(file_path) and file_path ~= "" then
	file_path = luci.http.urldecode(file_path)
=======
local DISP = require "luci.dispatcher"
local file_path = fs.get_file_path_from_request()

if not file_path then
	HTTP.redirect(DISP.build_url("admin", "services", "openclash", "%s") % arg[1])
	return
>>>>>>> upstream/master
end

m = Map("openclash", translate("File Edit"))
m.pageaction = false
<<<<<<< HEAD
m.redirect = luci.dispatcher.build_url("admin/services/openclash/"..arg[1])
=======
m.redirect = DISP.build_url("admin", "services", "openclash", "other-file-edit", "%s") % arg[1].."?file="..HTTP.urlencode(file_path)
>>>>>>> upstream/master
s = m:section(TypedSection, "openclash")
s.anonymous = true
s.addremove=false

o = s:option(TextValue, "edit_file")
o.rows = 50
o.wrap = "off"

function o.write(self, section, value)
	if value then
		value = value:gsub("\r\n?", "\n")
		local old_value = fs.readfile(file_path)
		if value ~= old_value then
			fs.writefile(file_path, value)
		end
	end
end

function o.cfgvalue(self, section)
	return fs.readfile(file_path) or ""
end

local t = {
	{Commit, Back}
}

a = m:section(Table, t)

o = a:option(Button, "Commit", " ")
o.inputtitle = translate("Commit Settings")
o.inputstyle = "apply"
o.write = function()
<<<<<<< HEAD
	luci.http.redirect(m.redirect)
=======
	HTTP.redirect(m.redirect)
>>>>>>> upstream/master
end

o = a:option(Button,"Back", " ")
o.inputtitle = translate("Back Settings")
o.inputstyle = "reset"
o.write = function()
<<<<<<< HEAD
	luci.http.redirect(m.redirect)
=======
	HTTP.redirect(DISP.build_url("admin", "services", "openclash", "%s") % arg[1])
>>>>>>> upstream/master
end

m:append(Template("openclash/config_editor"))
m:append(Template("openclash/toolbar_show"))
return m