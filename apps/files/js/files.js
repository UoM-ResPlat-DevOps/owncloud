/*
 * Copyright (c) 2014
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

/* global getURLParameter */
/**
 * Utility class for file related operations
 */
(function() {
	var Files = {
		// file space size sync
		_updateStorageStatistics: function(currentDir) {
			var state = Files.updateStorageStatistics;
			if (state.dir){
				if (state.dir === currentDir) {
					return;
				}
				// cancel previous call, as it was for another dir
				state.call.abort();
			}
			state.dir = currentDir;
			state.call = $.getJSON(OC.filePath('files','ajax','getstoragestats.php') + '?dir=' + encodeURIComponent(currentDir),function(response) {
				state.dir = null;
				state.call = null;
				Files.updateMaxUploadFilesize(response);
			});
		},
		/**
		 * Update storage statistics such as free space, max upload,
		 * etc based on the given directory.
		 *
		 * Note this function is debounced to avoid making too
		 * many ajax calls in a row.
		 *
		 * @param dir directory
		 * @param force whether to force retrieving
		 */
		updateStorageStatistics: function(dir, force) {
			if (!OC.currentUser) {
				return;
			}

			if (force) {
				Files._updateStorageStatistics(dir);
			}
			else {
				Files._updateStorageStatisticsDebounced(dir);
			}
		},

		updateMaxUploadFilesize:function(response) {
			if (response === undefined) {
				return;
			}
			if (response.data !== undefined && response.data.uploadMaxFilesize !== undefined) {
				$('#max_upload').val(response.data.uploadMaxFilesize);
				$('#free_space').val(response.data.freeSpace);
				$('#upload.button').attr('data-original-title', response.data.maxHumanFilesize);
				$('#usedSpacePercent').val(response.data.usedSpacePercent);
				$('#owner').val(response.data.owner);
				$('#ownerDisplayName').val(response.data.ownerDisplayName);
				Files.displayStorageWarnings();
			}
			if (response[0] === undefined) {
				return;
			}
			if (response[0].uploadMaxFilesize !== undefined) {
				$('#max_upload').val(response[0].uploadMaxFilesize);
				$('#upload.button').attr('data-original-title', response[0].maxHumanFilesize);
				$('#usedSpacePercent').val(response[0].usedSpacePercent);
				Files.displayStorageWarnings();
			}

		},

		/**
		 * Fix path name by removing double slash at the beginning, if any
		 */
		fixPath: function(fileName) {
			if (fileName.substr(0, 2) == '//') {
				return fileName.substr(1);
			}
			return fileName;
		},

		/**
		 * Checks whether the given file name is valid.
		 * @param name file name to check
		 * @return true if the file name is valid.
		 * Throws a string exception with an error message if
		 * the file name is not valid
		 */
		isFileNameValid: function (name) {
			var trimmedName = name.trim();
			if (trimmedName === '.'	|| trimmedName === '..')
			{
				throw t('files', '"{name}" is an invalid file name.', {name: name});
			} else if (trimmedName.length === 0) {
				throw t('files', 'File name cannot be empty.');
			}
			return true;
		},
		displayStorageWarnings: function() {
			if (!OC.Notification.isHidden()) {
				return;
			}

			var usedSpacePercent = $('#usedSpacePercent').val(),
				owner = $('#owner').val(),
				ownerDisplayName = $('#ownerDisplayName').val();
			if (usedSpacePercent > 98) {
				if (owner !== oc_current_user) {
					OC.Notification.show(t('files', 'Storage of {owner} is full, files can not be updated or synced anymore!',
						{ owner: ownerDisplayName }));
					return;
				}
				OC.Notification.show(t('files', 'Your storage is full, files can not be updated or synced anymore!'));
				return;
			}
			if (usedSpacePercent > 90) {
				if (owner !== oc_current_user) {
					OC.Notification.show(t('files', 'Storage of {owner} is almost full ({usedSpacePercent}%)',
						{ usedSpacePercent: usedSpacePercent,  owner: ownerDisplayName }));
					return;
				}
				OC.Notification.show(t('files', 'Your storage is almost full ({usedSpacePercent}%)',
					{usedSpacePercent: usedSpacePercent}));
			}
		},

		/**
		 * Returns the download URL of the given file(s)
		 * @param filename string or array of file names to download
		 * @param dir optional directory in which the file name is, defaults to the current directory
		 */
		getDownloadUrl: function(filename, dir) {
			if ($.isArray(filename)) {
				filename = JSON.stringify(filename);
			}
			var params = {
				dir: dir,
				files: filename
			};
			return this.getAjaxUrl('download', params);
		},

		/**
		 * Returns the ajax URL for a given action
		 * @param action action string
		 * @param params optional params map
		 */
		getAjaxUrl: function(action, params) {
			var q = '';
			if (params) {
				q = '?' + OC.buildQueryString(params);
			}
			return OC.filePath('files', 'ajax', action + '.php') + q;
		},

		/**
		 * Fetch the icon url for the mimetype
		 * @param {string} mime The mimetype
		 * @param {Files~mimeicon} ready Function to call when mimetype is retrieved
		 * @deprecated use OC.MimeType.getIconUrl(mime)
		 */
		getMimeIcon: function(mime, ready) {
			ready(OC.MimeType.getIconUrl(mime));
		},

		/**
		 * Generates a preview URL based on the URL space.
		 * @param urlSpec attributes for the URL
		 * @param {int} urlSpec.x width
		 * @param {int} urlSpec.y height
		 * @param {String} urlSpec.file path to the file
		 * @return preview URL
		 * @deprecated used OCA.Files.FileList.generatePreviewUrl instead
		 */
		generatePreviewUrl: function(urlSpec) {
			console.warn('DEPRECATED: please use generatePreviewUrl() from an OCA.Files.FileList instance');
			return OCA.Files.App.fileList.generatePreviewUrl(urlSpec);
		},

		/**
		 * Lazy load preview
		 * @deprecated used OCA.Files.FileList.lazyLoadPreview instead
		 */
		lazyLoadPreview : function(path, mime, ready, width, height, etag) {
			console.warn('DEPRECATED: please use lazyLoadPreview() from an OCA.Files.FileList instance');
			return OCA.Files.App.fileList.lazyLoadPreview({
				path: path,
				mime: mime,
				callback: ready,
				width: width,
				height: height,
				etag: etag
			});
		},

		/**
		 * Initialize the files view
		 */
		initialize: function() {
			Files.bindKeyboardShortcuts(document, $);

			// TODO: move file list related code (upload) to OCA.Files.FileList
			$('#file_action_panel').attr('activeAction', false);

			// Triggers invisible file input
			$('#upload a').on('click', function() {
				$(this).parent().children('#file_upload_start').trigger('click');
				return false;
			});

			// Trigger cancelling of file upload
			$('#uploadprogresswrapper .stop').on('click', function() {
				OC.Upload.cancelUploads();
			});

			// drag&drop support using jquery.fileupload
			// TODO use OC.dialogs
			$(document).bind('drop dragover', function (e) {
					e.preventDefault(); // prevent browser from doing anything, if file isn't dropped in dropZone
				});

			//do a background scan if needed
			scanFiles();

			// display storage warnings
			setTimeout(Files.displayStorageWarnings, 100);
			OC.Notification.setDefault(Files.displayStorageWarnings);

			// only possible at the moment if user is logged in or the files app is loaded
			if (OC.currentUser && OCA.Files.App) {
				// start on load - we ask the server every 5 minutes
				var func = _.bind(OCA.Files.App.fileList.updateStorageStatistics, OCA.Files.App.fileList);
				var updateStorageStatisticsInterval = 5*60*1000;
				var updateStorageStatisticsIntervalId = setInterval(func, updateStorageStatisticsInterval);

				// TODO: this should also stop when switching to another view
				// Use jquery-visibility to de-/re-activate file stats sync
				if ($.support.pageVisibility) {
					$(document).on({
						'show.visibility': function() {
							if (!updateStorageStatisticsIntervalId) {
								updateStorageStatisticsIntervalId = setInterval(func, updateStorageStatisticsInterval);
							}
						},
						'hide.visibility': function() {
							clearInterval(updateStorageStatisticsIntervalId);
							updateStorageStatisticsIntervalId = 0;
						}
					});
				}
			}


			$('#webdavurl').on('click', function () {
				$('#webdavurl').select();
			});

			//FIXME scroll to and highlight preselected file
			/*
			if (getURLParameter('scrollto')) {
				FileList.scrollTo(getURLParameter('scrollto'));
			}
			*/
		}
	}

	Files._updateStorageStatisticsDebounced = _.debounce(Files._updateStorageStatistics, 250);
	OCA.Files.Files = Files;
})();

function scanFiles(force, dir, users) {
	if (!OC.currentUser) {
		return;
	}

	if (!dir) {
		dir = '';
	}
	force = !!force; //cast to bool
	scanFiles.scanning = true;
	var scannerEventSource;
	if (users) {
		var usersString;
		if (users === 'all') {
			usersString = users;
		} else {
			usersString = JSON.stringify(users);
		}
		scannerEventSource = new OC.EventSource(OC.filePath('files','ajax','scan.php'),{force: force,dir: dir, users: usersString});
	} else {
		scannerEventSource = new OC.EventSource(OC.filePath('files','ajax','scan.php'),{force: force,dir: dir});
	}
	scanFiles.cancel = scannerEventSource.close.bind(scannerEventSource);
	scannerEventSource.listen('count',function(count) {
		console.log(count + ' files scanned');
	});
	scannerEventSource.listen('folder',function(path) {
		console.log('now scanning ' + path);
	});
	scannerEventSource.listen('done',function(count) {
		scanFiles.scanning=false;
		console.log('done after ' + count + ' files');
		if (OCA.Files.App) {
			OCA.Files.App.fileList.updateStorageStatistics(true);
		}
	});
	scannerEventSource.listen('user',function(user) {
		console.log('scanning files for ' + user);
	});
}
scanFiles.scanning=false;

// TODO: move to FileList
var createDragShadow = function(event) {
	//select dragged file
	var FileList = OCA.Files.App.fileList;
	var isDragSelected = $(event.target).parents('tr').find('td input:first').prop('checked');
	if (!isDragSelected) {
		//select dragged file
		FileList._selectFileEl($(event.target).parents('tr:first'), true);
	}

	// do not show drag shadow for too many files
	var selectedFiles = _.first(FileList.getSelectedFiles(), FileList.pageSize());
	selectedFiles = _.sortBy(selectedFiles, FileList._fileInfoCompare);

	if (!isDragSelected && selectedFiles.length === 1) {
		//revert the selection
		FileList._selectFileEl($(event.target).parents('tr:first'), false);
	}

	// build dragshadow
	var dragshadow = $('<table class="dragshadow"></table>');
	var tbody = $('<tbody></tbody>');
	dragshadow.append(tbody);

	var dir = FileList.getCurrentDirectory();

	$(selectedFiles).each(function(i,elem) {
		// TODO: refactor this with the table row creation code
		var newtr = $('<tr/>')
			.attr('data-dir', dir)
			.attr('data-file', elem.name)
			.attr('data-origin', elem.origin);
		newtr.append($('<td class="filename" />').text(elem.name).css('background-size', 32));
		newtr.append($('<td class="size" />').text(OC.Util.humanFileSize(elem.size)));
		tbody.append(newtr);
		if (elem.type === 'dir') {
			newtr.find('td.filename')
				.css('background-image', 'url(' + OC.imagePath('core', 'filetypes/folder.png') + ')');
		} else {
			var path = dir + '/' + elem.name;
			OCA.Files.App.files.lazyLoadPreview(path, elem.mime, function(previewpath) {
				newtr.find('td.filename')
					.css('background-image', 'url(' + previewpath + ')');
			}, null, null, elem.etag);
		}
	});

	return dragshadow;
};

//options for file drag/drop
//start&stop handlers needs some cleaning up
// TODO: move to FileList class
var dragOptions={
	revert: 'invalid',
	revertDuration: 300,
	opacity: 0.7,
	zIndex: 100,
	appendTo: 'body',
	cursorAt: { left: 24, top: 18 },
	helper: createDragShadow,
	cursor: 'move',
	start: function(event, ui){
		var $selectedFiles = $('td.filename input:checkbox:checked');
		if($selectedFiles.length > 1){
			$selectedFiles.parents('tr').fadeTo(250, 0.2);
		}
		else{
			$(this).fadeTo(250, 0.2);
		}
	},
	stop: function(event, ui) {
		var $selectedFiles = $('td.filename input:checkbox:checked');
		if($selectedFiles.length > 1){
			$selectedFiles.parents('tr').fadeTo(250, 1);
		}
		else{
			$(this).fadeTo(250, 1);
		}
		$('#fileList tr td.filename').addClass('ui-draggable');
	}
};
// sane browsers support using the distance option
if ( $('html.ie').length === 0) {
	dragOptions['distance'] = 20;
}

// TODO: move to FileList class
var folderDropOptions = {
	hoverClass: "canDrop",
	drop: function( event, ui ) {
		// don't allow moving a file into a selected folder
		var FileList = OCA.Files.App.fileList;
		if ($(event.target).parents('tr').find('td input:first').prop('checked') === true) {
			return false;
		}

		var $tr = $(this).closest('tr');
		if (($tr.data('permissions') & OC.PERMISSION_CREATE) === 0) {
			FileList._showPermissionDeniedNotification();
			return false;
		}
		var targetPath = FileList.getCurrentDirectory() + '/' + $tr.data('file');

		var files = FileList.getSelectedFiles();
		if (files.length === 0) {
			// single one selected without checkbox?
			files = _.map(ui.helper.find('tr'), FileList.elementToFile);
		}

		FileList.move(_.pluck(files, 'name'), targetPath);
	},
	tolerance: 'pointer'
};

// override core's fileDownloadPath (legacy)
function fileDownloadPath(dir, file) {
	return OCA.Files.Files.getDownloadUrl(file, dir);
}

// for backward compatibility
window.Files = OCA.Files.Files;

